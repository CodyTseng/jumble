import QrCode from '@/components/QrCode'
import UserAvatar from '@/components/UserAvatar'
import Username from '@/components/Username'
import { Button } from '@/components/ui/button'
import { Modal, ModalContent } from '@/components/ui/modal'
import { toJumbleProfile } from '@/lib/link'
import { copyText } from '@/lib/native-system'
import { Copy, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function ProfileShareButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const url = toJumbleProfile(pubkey)

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url })
        return
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return
      }
    }
    setOpen(true)
  }

  const copy = async () => {
    try {
      await copyText(url)
      toast.success(t('Copied to Clipboard'))
    } catch {
      toast.error(t('Something went wrong'))
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="titlebar-icon"
        title={t('Share profile')}
        aria-label={t('Share profile')}
        onClick={share}
      >
        <Share2 />
      </Button>
      <Modal open={open} onOpenChange={setOpen}>
        <ModalContent title={t('Share profile')}>
          <div className="flex flex-col items-center gap-4 p-4">
            <UserAvatar userId={pubkey} size="big" />
            <Username userId={pubkey} className="max-w-full truncate text-xl font-semibold" />
            <QrCode value={url} size={256} />
            <div dir="ltr" className="w-full text-center text-sm break-all select-text">
              {url}
            </div>
            <Button onClick={copy} className="w-full">
              <Copy />
              {t('Copy share link')}
            </Button>
          </div>
        </ModalContent>
      </Modal>
    </>
  )
}
