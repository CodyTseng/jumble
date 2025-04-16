import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle
} from '@/components/ui/drawer'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Dispatch, SetStateAction, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import ZapDialogContent from './ZapDialogContent'

export default function ZapDialog({
  open,
  setOpen,
  pubkey,
  eventId,
  defaultAmount
}: {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  pubkey: string
  eventId?: string
  defaultAmount?: number
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const drawerContentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleResize = () => {
      if (drawerContentRef.current) {
        drawerContentRef.current.style.setProperty('bottom', `env(safe-area-inset-bottom)`)
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      handleResize()
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerOverlay onClick={() => setOpen(false)} />
        <DrawerContent
          hideOverlay
          onOpenAutoFocus={(e) => e.preventDefault()}
          ref={drawerContentRef}
          className="flex flex-col gap-4 px-4 mb-4"
        >
          <DrawerHeader>
            <DrawerTitle className="flex gap-2 items-center">
              <div className="shrink-0">{t('Zap to')}</div>
              <UserAvatar size="small" userId={pubkey} />
              <Username userId={pubkey} className="truncate flex-1 w-0 text-start h-5" />
            </DrawerTitle>
            <DialogDescription></DialogDescription>
          </DrawerHeader>
          <ZapDialogContent
            setOpen={setOpen}
            recipient={pubkey}
            eventId={eventId}
            defaultAmount={defaultAmount}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogOverlay onClick={() => setOpen(false)} />
      <DialogContent hideOverlay onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <div className="shrink-0">{t('Zap to')}</div>
            <UserAvatar size="small" userId={pubkey} />
            <Username userId={pubkey} className="truncate flex-1 w-0 text-start h-5" />
          </DialogTitle>
        </DialogHeader>
        <ZapDialogContent
          setOpen={setOpen}
          recipient={pubkey}
          eventId={eventId}
          defaultAmount={defaultAmount}
        />
      </DialogContent>
    </Dialog>
  )
}
