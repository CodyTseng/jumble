import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useNostr } from '@/providers/NostrProvider'
import dmMessageService from '@/services/dm-message.service'
import encryptionKeyService from '@/services/encryption-key.service'
import { Loader2, Send } from 'lucide-react'
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
  const [isSending, setIsSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = async () => {
    if (!pubkey || !content.trim() || isSending || disabled) return

    const encryptionKeypair = encryptionKeyService.getEncryptionKeypair(pubkey)
    if (!encryptionKeypair) {
      toast.error(t('Encryption key not found'))
      return
    }

    setIsSending(true)
    try {
      await dmMessageService.sendMessage(
        pubkey,
        recipientPubkey,
        content.trim(),
        encryptionKeypair
      )
      setContent('')
      textareaRef.current?.focus()
    } catch (error) {
      console.error('Failed to send message:', error)
      toast.error(t('Failed to send message'))
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t p-3 bg-background">
      <div className="flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          placeholder={t('Type a message...')}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSending}
          rows={1}
          className="min-h-[40px] max-h-32 resize-none"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!content.trim() || isSending || disabled}
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1 text-center">
        {t('Press Ctrl+Enter or Cmd+Enter to send')}
      </p>
    </div>
  )
}
