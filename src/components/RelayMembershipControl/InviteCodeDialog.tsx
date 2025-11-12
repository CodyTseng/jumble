import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import relayMembershipService from '@/services/relay-membership.service'
import { TRelayInfo } from '@/types'
import { Check, Copy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function InviteCodeDialog({
  relayInfo,
  showInviteCodeDialog,
  setShowInviteCodeDialog
}: {
  relayInfo: TRelayInfo
  showInviteCodeDialog: boolean
  setShowInviteCodeDialog: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const [isFetching, setIsFetching] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!showInviteCodeDialog) {
      setInviteCode('')
      return
    }

    const getInviteCode = async () => {
      setIsFetching(true)
      try {
        if (relayInfo.pubkey) {
          const code = await relayMembershipService.requestInviteCode(
            relayInfo.url,
            relayInfo.pubkey
          )
          if (code) {
            setInviteCode(code)
          } else {
            toast.error(t('Failed to get invite code from relay'))
          }
        }
      } catch (error: any) {
        toast.error(error.message || t('Failed to get invite code'))
      } finally {
        setIsFetching(false)
      }
    }
    getInviteCode()
  }, [showInviteCodeDialog])

  const handleCopyInviteCode = () => {
    if (!inviteCode) return

    navigator.clipboard.writeText(inviteCode)
    toast.success(t('Invite code copied to clipboard'))
    setCopied(true)

    setTimeout(() => {
      setCopied(false)
    }, 2000)
  }

  const content = isFetching ? (
    <div className="flex items-center justify-center py-8">
      <div className="text-muted-foreground">{t('Loading...')}</div>
    </div>
  ) : inviteCode ? (
    <div className="space-y-2">
      <Label htmlFor="fetched-invite-code">{t('Invite Code')}</Label>
      <div className="flex gap-2">
        <Input id="fetched-invite-code" value={inviteCode} readOnly className="font-mono" />
        <Button onClick={handleCopyInviteCode} variant="outline">
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t('This invite code can be used by others to join the relay.')}
      </p>
    </div>
  ) : (
    <div className="text-center py-8 text-muted-foreground">
      {t('No invite code available from this relay.')}
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={showInviteCodeDialog} onOpenChange={setShowInviteCodeDialog}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('Get Invite Code')}</DrawerTitle>
            <DrawerDescription>
              {t('Share this invite code with others to invite them to join this relay.')}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">{content}</div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={showInviteCodeDialog} onOpenChange={setShowInviteCodeDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Get Invite Code')}</DialogTitle>
          <DialogDescription>
            {t('Share this invite code with others to invite them to join this relay.')}
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  )
}
