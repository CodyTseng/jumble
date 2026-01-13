import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { formatAmount } from '@/lib/lightning'
import { Zap } from 'lucide-react'
import { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import Content from '../Content'
import { FormattedTimestamp } from '../FormattedTimestamp'

interface ZapDetailDialogProps {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  zap: {
    pubkey: string
    amount: number
    comment?: string
    created_at: number
  }
}

export default function ZapDetailDialog({ open, setOpen, zap }: ZapDetailDialogProps) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  const content = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <UserAvatar userId={zap.pubkey} size="medium" />
        <div className="flex-1">
          <Username userId={zap.pubkey} className="font-semibold" />
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <FormattedTimestamp timestamp={zap.created_at} />
          </div>
        </div>
        <div className="flex items-center gap-1 text-yellow-400">
          <Zap className="size-5 fill-yellow-400" />
          <span className="text-lg font-bold">{formatAmount(zap.amount)}</span>
        </div>
      </div>
      {zap.comment && <Content content={zap.comment} />}
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="px-4 pb-4">
          <DrawerHeader>
            <DrawerTitle>{t('Zap Details')}</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t('Zap Details')}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
