import { SimpleUsername } from '@/components/Username'
import { useNostr } from '@/providers/NostrProvider'
import dmService from '@/services/dm.service'
import { ArrowUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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

  const handleSend = async () => {
    if (!pubkey || !content.trim() || disabled) return

    const messageContent = content.trim()
    setContent('')
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
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  const hasContent = content.trim().length > 0

  return (
    <div className="border-t bg-background px-4 py-2">
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-secondary/50 px-3 py-1.5">
          <div className="min-w-0 flex-1 border-l-2 border-primary pl-2">
            <SimpleUsername
              userId={replyTo.senderPubkey}
              className="text-xs font-medium text-primary"
              withoutSkeleton
            />
            <p className="truncate text-xs text-muted-foreground">
              {replyTo.content || '...'}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="shrink-0 rounded-full p-0.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          placeholder={t('Type a message...')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="max-h-40 min-h-[36px] flex-1 select-text resize-none overflow-y-auto bg-transparent py-2 text-base placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!hasContent || disabled}
          className="mb-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
