import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Textarea } from '@/components/ui/textarea'
import { pubkeyToNpub } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
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

export default function TextareaWithMentions({
  textValue,
  setTextValue,
  ...props
}: ComponentProps<'textarea'> & {
  textValue: string
  setTextValue: Dispatch<SetStateAction<string>>
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [commandValue, setCommandValue] = useState('')
  const [debouncedCommandValue, setDebouncedCommandValue] = useState(commandValue)
  const [profiles, setProfiles] = useState<TProfile[]>([])

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
      replaceWord(textarea, `${value}`)
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

  return (
    <div className="relative w-full">
      <Textarea {...props} ref={textareaRef} value={textValue} onChange={onTextValueChange} />
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
                  <SimpleUsername userId={p.pubkey} className="font-semibold truncate" />
                  <Nip05 pubkey={p.pubkey} />
                </div>
              </CommandItem>
            )
          })}
        </CommandList>
      </Command>
    </div>
  )
}
