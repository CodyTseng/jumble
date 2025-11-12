import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createJoinDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import relayMembershipService from '@/services/relay-membership.service'
import { TRelayInfo } from '@/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function JoinDialog({
  relayInfo,
  showJoinDialog,
  setShowJoinDialog,
  onMembershipStatusChange
}: {
  relayInfo: TRelayInfo
  showJoinDialog: boolean
  setShowJoinDialog: (open: boolean) => void
  onMembershipStatusChange: (status: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { publish } = useNostr()
  const [inviteCode, setInviteCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleJoinSubmit = async () => {
    setIsLoading(true)
    try {
      const draftEvent = createJoinDraftEvent(inviteCode)
      const joinRequestEvent = await publish(draftEvent, {
        specifiedRelayUrls: [relayInfo.url]
      })
      toast.success(t('Join request sent successfully'))
      await relayMembershipService.addNewMember(relayInfo.url, joinRequestEvent.pubkey)
      onMembershipStatusChange(true)
      setInviteCode('')
      setShowJoinDialog(false)
    } catch (error) {
      const errors = error instanceof AggregateError ? error.errors : [error]
      errors.forEach((err) => {
        toast.error(
          `${t('Failed to send join request')}: ${err instanceof Error ? err.message : String(err)}`,
          { duration: 10_000 }
        )
        console.error(err)
      })
      return
    } finally {
      setIsLoading(false)
    }
  }

  const content = (
    <div className="space-y-2">
      <Label htmlFor="invite-code">{t('Invite Code')}</Label>
      <Input
        id="invite-code"
        value={inviteCode}
        onChange={(e) => setInviteCode(e.target.value)}
        placeholder={t('Enter invite code')}
        required
      />
      <p className="text-sm text-muted-foreground">
        {t('You can get an invite code from a relay member.')}
      </p>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={showJoinDialog} onOpenChange={setShowJoinDialog}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('Request to Join Relay')}</DrawerTitle>
            <DrawerDescription>
              {t('Enter the invite code you received from a relay member.')}
            </DrawerDescription>
          </DrawerHeader>
          <div className="p-4">{content}</div>
          <DrawerFooter>
            <Button onClick={handleJoinSubmit} disabled={isLoading || !inviteCode.trim()}>
              {isLoading ? t('Sending...') : t('Send Request')}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline">{t('Cancel')}</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('Request to Join Relay')}</DialogTitle>
          <DialogDescription>
            {t('Enter the invite code you received from a relay member.')}
          </DialogDescription>
        </DialogHeader>
        {content}
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => {
              setShowJoinDialog(false)
              setInviteCode('')
            }}
          >
            {t('Cancel')}
          </Button>
          <Button onClick={handleJoinSubmit} disabled={isLoading || !inviteCode.trim()}>
            {isLoading ? t('Sending...') : t('Send Request')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
