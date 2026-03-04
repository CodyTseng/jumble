import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Bitcoin, Check, Copy, QrCodeIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import QrCode from '../QrCode'

export default function SpQrCode({ sp }: { sp: string }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [copied, setCopied] = useState(false)

  if (!sp) return null

  const truncated = sp.length > 24 ? sp.slice(0, 12) + '...' + sp.slice(-6) : sp

  const copySp = () => {
    navigator.clipboard.writeText(sp)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const trigger = (
    <div className="flex h-5 w-5 flex-col items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground">
      <QrCodeIcon size={14} />
    </div>
  )

  const content = (
    <div className="flex w-full flex-col items-center gap-4 p-8">
      <div className="flex items-center gap-2 text-orange-500">
        <Bitcoin size={24} />
        <div className="text-lg font-semibold">{t('Silent Payment')}</div>
      </div>
      <QrCode size={512} value={sp} />
      <div
        className="clickable flex w-fit items-center gap-2 rounded-full bg-muted px-2 text-sm text-muted-foreground"
        onClick={copySp}
      >
        <div className="font-mono text-xs">{truncated}</div>
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </div>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer>
        <DrawerTrigger>{trigger}</DrawerTrigger>
        <DrawerContent>{content}</DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog>
      <DialogTrigger>{trigger}</DialogTrigger>
      <DialogContent className="m-0 w-80 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        {content}
      </DialogContent>
    </Dialog>
  )
}
