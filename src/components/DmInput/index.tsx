import { useNostr } from '@/providers/NostrProvider'
import dmService from '@/services/dm.service'
import { ArrowUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function DmInput({
  recipientPubkey,
  disabled = false
}: {
  recipientPubkey: string
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    if (!pubkey || !content.trim() || disabled) return

    const messageContent = content.trim()
    setContent('')
    textareaRef.current?.focus()

    try {
      await dmService.sendMessage(pubkey, recipientPubkey, messageContent)
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
    <div className="border-t bg-background px-3 py-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          placeholder={t('Type a message...')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="max-h-32 min-h-[36px] flex-1 select-text resize-none bg-transparent py-2 text-base placeholder:text-muted-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!hasContent || disabled}
          className="mb-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
