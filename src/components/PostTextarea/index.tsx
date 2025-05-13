import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks'
import { pubkeyToNpub } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useMediaUploadService } from '@/providers/MediaUploadServiceProvider'
import client from '@/services/client.service'
import { TProfile } from '@/types'
import React, {
  ComponentProps,
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react'
import Nip05 from '../Nip05'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'
import { getCurrentWord, replaceWord } from './utils'

export default function PostTextarea({
  textValue,
  setTextValue,
  cursorOffset = 0,
  onUploadImage,
  ...props
}: ComponentProps<'textarea'> & {
  textValue: string
  setTextValue: Dispatch<SetStateAction<string>>
  cursorOffset?: number
  onUploadImage?: ({ url, tags }: { url: string; tags: string[][] }) => void
}) {
  const { toast } = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { upload } = useMediaUploadService()
  const [commandValue, setCommandValue] = useState('')
  const [debouncedCommandValue, setDebouncedCommandValue] = useState(commandValue)
  const [profiles, setProfiles] = useState<TProfile[]>([])
  const [dragover, setDragover] = useState(false)

  useEffect(() => {
    if (textareaRef.current && cursorOffset !== 0) {
      const textarea = textareaRef.current
      const newPos = Math.max(0, textarea.selectionStart - cursorOffset)
      textarea.setSelectionRange(newPos, newPos)
      textarea.focus()
    }
  }, [cursorOffset])

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCommandValue(commandValue)
    }, 500)

    return () => {
      clearTimeout(handler)
    }
  }, [commandValue])

  useEffect(() => {
    setProfiles([])
    if (debouncedCommandValue) {
      const fetchProfiles = async () => {
        const newProfiles = await client.searchProfilesFromIndex(debouncedCommandValue, 100)
        setProfiles(newProfiles)
      }
      fetchProfiles()
    }
  }, [debouncedCommandValue])

  useEffect(() => {
    const dropdown = dropdownRef.current
    if (!dropdown) return

    if (profiles.length > 0) {
      dropdown.classList.remove('hidden')
    } else {
      dropdown.classList.add('hidden')
    }
  }, [profiles])

  const handleBlur = useCallback(() => {
    const dropdown = dropdownRef.current
    if (dropdown) {
      dropdown.classList.add('hidden')
      setCommandValue('')
    }
  }, [])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const textarea = textareaRef.current
    const input = inputRef.current
    const dropdown = dropdownRef.current
    if (textarea && input && dropdown) {
      const currentWord = getCurrentWord(textarea)
      const isDropdownHidden = dropdown.classList.contains('hidden')
      if (currentWord.startsWith('@') && !isDropdownHidden) {
        if (
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'Enter' ||
          e.key === 'Escape'
        ) {
          e.preventDefault()
          input.dispatchEvent(new KeyboardEvent('keydown', e))
        }
      }
    }
  }, [])

  const onTextValueChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value
      const textarea = textareaRef.current
      const dropdown = dropdownRef.current

      if (textarea && dropdown) {
        const currentWord = getCurrentWord(textarea)
        setTextValue(text)
        if (currentWord.startsWith('@') && currentWord.length > 1) {
          setCommandValue(currentWord.slice(1))
        } else {
          // REMINDER: apparently, we need it when deleting
          if (commandValue !== '') {
            setCommandValue('')
            dropdown.classList.add('hidden')
          }
        }
      }
    },
    [setTextValue, commandValue]
  )

  const onCommandSelect = useCallback((value: string) => {
    const textarea = textareaRef.current
    const dropdown = dropdownRef.current
    if (textarea && dropdown) {
      replaceWord(textarea, `${value} `)
      setCommandValue('')
      dropdown.classList.add('hidden')
    }
  }, [])

  const handleMouseDown = useCallback((e: Event) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleSectionChange = useCallback(() => {
    const textarea = textareaRef.current
    const dropdown = dropdownRef.current
    if (textarea && dropdown) {
      const currentWord = getCurrentWord(textarea)
      if (!currentWord.startsWith('@') && commandValue !== '') {
        setCommandValue('')
        dropdown.classList.add('hidden')
      }
    }
  }, [commandValue])

  useEffect(() => {
    const textarea = textareaRef.current
    const dropdown = dropdownRef.current
    textarea?.addEventListener('keydown', handleKeyDown)
    textarea?.addEventListener('blur', handleBlur)
    document?.addEventListener('selectionchange', handleSectionChange)
    dropdown?.addEventListener('mousedown', handleMouseDown)
    return () => {
      textarea?.removeEventListener('keydown', handleKeyDown)
      textarea?.removeEventListener('blur', handleBlur)
      document?.removeEventListener('selectionchange', handleSectionChange)
      dropdown?.removeEventListener('mousedown', handleMouseDown)
    }
  }, [handleBlur, handleKeyDown, handleMouseDown, handleSectionChange])

  const uploadImages = async (files: File[]) => {
    for (const file of files) {
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        const placeholder = `[Uploading "${file.name}"...]`
        if (textValue.includes(placeholder)) {
          continue
        }
        setTextValue((prev) => (prev === '' ? placeholder : `${prev}\n${placeholder}`))
        try {
          const result = await upload(file)
          setTextValue((prev) => {
            if (prev.includes(placeholder)) {
              return prev.replace(placeholder, result.url)
            } else {
              return prev + `\n${result.url}`
            }
          })
          onUploadImage?.(result)
        } catch (error) {
          console.error('Error uploading file', error)
          toast({
            variant: 'destructive',
            title: 'Failed to upload file',
            description: (error as Error).message
          })
          setTextValue((prev) => prev.replace(placeholder, ''))
        }
      }
    }
  }

  const handlePast = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    await uploadImages(
      Array.from(e.clipboardData.items)
        .map((item) => item.getAsFile())
        .filter(Boolean) as File[]
    )
  }

  const handleDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault()
    setDragover(false)
    await uploadImages(Array.from(e.dataTransfer.files))
  }

  return (
    <div
      className={cn(
        'relative w-full',
        dragover && 'outline-2 outline-offset-4 outline-dashed outline-border rounded-md'
      )}
    >
      <Textarea
        {...props}
        ref={textareaRef}
        value={textValue}
        onChange={onTextValueChange}
        onPaste={handlePast}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault()
          setDragover(true)
        }}
        onDragLeave={() => {
          setDragover(false)
        }}
      />
      <Command
        ref={dropdownRef}
        className={cn(
          'sm:fixed hidden translate-y-2 h-auto w-full sm:w-[462px] z-10 border border-popover shadow'
        )}
        shouldFilter={false}
      >
        <div className="hidden">
          <CommandInput ref={inputRef} value={commandValue} />
        </div>
        <CommandList scrollAreaClassName="h-44">
          {profiles.map((p) => {
            return (
              <CommandItem
                key={p.pubkey}
                value={`nostr:${pubkeyToNpub(p.pubkey)}`}
                onSelect={onCommandSelect}
              >
                <div className="flex gap-2 items-center pointer-events-none truncate">
                  <SimpleUserAvatar userId={p.pubkey} />
                  <div>
                    <SimpleUsername userId={p.pubkey} className="font-semibold truncate" />
                    <Nip05 pubkey={p.pubkey} />
                  </div>
                </div>
              </CommandItem>
            )
          })}
        </CommandList>
      </Command>
    </div>
  )
}
