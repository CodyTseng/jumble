import ContentPreviewContent from '@/components/ContentPreview/Content'
import FollowingBadge from '@/components/FollowingBadge'
import Nip05 from '@/components/Nip05'
import Uploader from '@/components/PostEditor/Uploader'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import { userIdToPubkey } from '@/lib/pubkey'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import dmService from '@/services/dm.service'
import { TProfile } from '@/types'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { restrictToParentElement } from '@dnd-kit/modifiers'
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowUp, File as FileIcon, FileAudio, ImageUp, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

type MediaItem = {
  id: string
  file: File
  previewUrl: string
  mimeType: string
  status: 'uploading' | 'done'
  progress: number
  cancel?: () => void
  url?: string
  tags?: string[][]
}

function SortableMediaItem({
  item,
  onRemove
}: {
  item: MediaItem
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  const circumference = Math.PI * 24 // radius 12, diameter 24
  const strokeDashoffset = circumference * (1 - item.progress / 100)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative shrink-0 cursor-grab touch-none active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      <div className="h-16 w-16 overflow-hidden rounded-md border">
        {item.mimeType.startsWith('image/') ? (
          <img
            src={item.status === 'done' && item.url ? item.url : item.previewUrl}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : item.mimeType.startsWith('video/') ? (
          <video src={item.previewUrl} className="h-full w-full object-cover" draggable={false} />
        ) : item.mimeType.startsWith('audio/') ? (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <FileAudio className="h-6 w-6 text-muted-foreground" />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-secondary">
            <FileIcon className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
      </div>
      {item.status === 'uploading' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40">
          <svg className="h-7 w-7 -rotate-90" viewBox="0 0 28 28">
            <circle
              cx="14"
              cy="14"
              r="12"
              fill="none"
              stroke="rgba(255,255,255,0.3)"
              strokeWidth="2"
            />
            <circle
              cx="14"
              cy="14"
              r="12"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
        </div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onRemove(item.id)
        }}
        className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  )
}

export default function DmInput({
  recipientPubkey,
  disabled = false,
  replyTo,
  onCancelReply,
  onSent
}: {
  recipientPubkey: string
  disabled?: boolean
  replyTo?: { id: string; content: string; senderPubkey: string } | null
  onCancelReply?: () => void
  onSent?: () => void
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [content, setContent] = useState('')
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionResults, setMentionResults] = useState<TProfile[]>([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const [mentionStart, setMentionStart] = useState(0)
  const mentionsRef = useRef<Map<string, string>>(new Map())

  const isUploading = mediaItems.some((item) => item.status === 'uploading')
  const doneItems = mediaItems.filter((item) => item.status === 'done')

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 }
    })
  )

  const adjustHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }

  useEffect(() => {
    adjustHeight()
  }, [content])

  useEffect(() => {
    if (replyTo) {
      textareaRef.current?.focus()
    }
  }, [replyTo])

  useEffect(() => {
    return () => {
      mediaItems.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  const detectMention = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    const cursorPos = textarea.selectionStart
    const textBeforeCursor = content.slice(0, cursorPos)
    const atIndex = textBeforeCursor.lastIndexOf('@')
    if (atIndex >= 0 && (atIndex === 0 || /\s/.test(textBeforeCursor[atIndex - 1]))) {
      const query = textBeforeCursor.slice(atIndex + 1)
      if (!/\s/.test(query)) {
        setMentionQuery(query)
        setMentionStart(atIndex)
        return
      }
    }
    setMentionQuery(null)
  }, [content])

  useEffect(() => {
    if (mentionQuery === null) {
      setMentionResults([])
      return
    }
    if (mentionQuery === '') {
      setMentionResults([])
      return
    }
    let cancelled = false
    client.searchProfilesFromLocal(mentionQuery, 10).then((results) => {
      if (!cancelled) {
        setMentionResults(results)
        setMentionIndex(0)
      }
    })
    return () => {
      cancelled = true
    }
  }, [mentionQuery])

  const insertMention = useCallback(
    (profile: TProfile) => {
      const displayText = profile.username
      const before = content.slice(0, mentionStart)
      const after = content.slice(
        mentionStart + 1 + (mentionQuery?.length ?? 0)
      )
      const newContent = `${before}@${displayText} ${after}`
      setContent(newContent)
      mentionsRef.current.set(displayText, profile.npub)
      setMentionQuery(null)
      setMentionResults([])

      const cursorPos = mentionStart + 1 + displayText.length + 1
      requestAnimationFrame(() => {
        const textarea = textareaRef.current
        if (textarea) {
          textarea.focus()
          textarea.setSelectionRange(cursorPos, cursorPos)
        }
      })
    },
    [content, mentionStart, mentionQuery]
  )

  const handleSend = async () => {
    if (!pubkey || (!content.trim() && doneItems.length === 0) || disabled || isUploading) return

    let text = content.trim()
    mentionsRef.current.forEach((npub, displayText) => {
      text = text.replaceAll(`@${displayText}`, `nostr:${npub}`)
    })
    const parts = [text, ...doneItems.map((a) => a.url!)].filter(Boolean)
    const messageContent = parts.join('\n')
    setContent('')
    mentionsRef.current.clear()
    mediaItems.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    setMediaItems([])
    textareaRef.current?.focus()

    try {
      await dmService.sendMessage(
        pubkey,
        recipientPubkey,
        messageContent,
        replyTo ?? undefined
      )
      onSent?.()
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error(t('Failed to send message'))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((prev) => (prev + mentionResults.length - 1) % mentionResults.length)
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((prev) => (prev + 1) % mentionResults.length)
        return
      }
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        insertMention(mentionResults[mentionIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionQuery(null)
        setMentionResults([])
        return
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleUploadStart = useCallback((file: File, cancel: () => void) => {
    const id = crypto.randomUUID()
    const previewUrl = URL.createObjectURL(file)
    setMediaItems((prev) => [
      ...prev,
      { id, file, previewUrl, mimeType: file.type, status: 'uploading', progress: 0, cancel }
    ])
  }, [])

  const handleProgress = useCallback((file: File, progress: number) => {
    setMediaItems((prev) =>
      prev.map((item) => (item.file === file ? { ...item, progress } : item))
    )
  }, [])

  const handleUploadSuccess = useCallback(
    ({ url, tags }: { url: string; tags: string[][] }, file: File) => {
      setMediaItems((prev) =>
        prev.map((item) =>
          item.file === file ? { ...item, status: 'done' as const, url, tags } : item
        )
      )
    },
    []
  )

  const handleUploadEnd = useCallback((file: File) => {
    setMediaItems((prev) => {
      const item = prev.find((i) => i.file === file)
      if (item && item.status === 'uploading') {
        // Upload failed or was cancelled — remove and revoke
        URL.revokeObjectURL(item.previewUrl)
        return prev.filter((i) => i.file !== file)
      }
      return prev
    })
  }, [])

  const handleRemoveItem = useCallback((id: string) => {
    setMediaItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item) {
        if (item.status === 'uploading' && item.cancel) {
          item.cancel()
        }
        URL.revokeObjectURL(item.previewUrl)
      }
      return prev.filter((i) => i.id !== id)
    })
  }, [])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setMediaItems((prev) => {
        const oldIndex = prev.findIndex((item) => item.id === active.id)
        const newIndex = prev.findIndex((item) => item.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const canSend = (content.trim().length > 0 || doneItems.length > 0) && !disabled && !isUploading

  return (
    <div className="relative border-t bg-background px-4 py-2">
      {mentionQuery !== null && mentionResults.length > 0 && (
        <div
          className="scrollbar-hide absolute bottom-full left-0 right-0 z-50 max-h-64 overflow-y-auto border-b border-t bg-background p-1"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          {mentionResults.map((profile, index) => (
            <button
              key={profile.npub}
              className={cn(
                'flex w-full cursor-pointer items-center gap-2 rounded-md p-2 text-start outline-none transition-colors [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
                mentionIndex === index && 'bg-accent text-accent-foreground'
              )}
              onMouseDown={(e) => {
                e.preventDefault()
                insertMention(profile)
              }}
              onMouseEnter={() => setMentionIndex(index)}
            >
              <SimpleUserAvatar userId={profile.npub} size="small" />
              <div className="w-0 flex-1">
                <div className="flex items-center gap-2">
                  <SimpleUsername
                    userId={profile.npub}
                    className="truncate font-semibold"
                  />
                  <FollowingBadge userId={profile.npub} />
                </div>
                <Nip05 pubkey={userIdToPubkey(profile.npub)} />
              </div>
            </button>
          ))}
        </div>
      )}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-1.5">
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
            <SimpleUsername
              userId={replyTo.senderPubkey}
              className="text-xs font-medium text-primary"
              withoutSkeleton
            />
            <ContentPreviewContent
              content={replyTo.content || '...'}
              className="block truncate text-xs text-muted-foreground"
            />
          </div>
          <button
            onClick={onCancelReply}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      {mediaItems.length > 0 && (
        <div className="mb-2 flex gap-2 overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToParentElement]}
          >
            <SortableContext
              items={mediaItems.map((item) => item.id)}
              strategy={horizontalListSortingStrategy}
            >
              {mediaItems.map((item) => (
                <SortableMediaItem key={item.id} item={item} onRemove={handleRemoveItem} />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      )}
      <div className="flex items-end gap-2">
        <Uploader
          accept="image/*,video/*,audio/*"
          onUploadStart={handleUploadStart}
          onProgress={handleProgress}
          onUploadEnd={handleUploadEnd}
          onUploadSuccess={handleUploadSuccess}
        >
          <button className="mb-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary">
            <ImageUp className="h-4 w-4" />
          </button>
        </Uploader>
        <textarea
          ref={textareaRef}
          placeholder={t('Type a message...')}
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            requestAnimationFrame(detectMention)
          }}
          onSelect={detectMention}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="max-h-40 min-h-[36px] flex-1 select-text resize-none overflow-y-auto bg-transparent py-2 text-base placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="mb-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
