import { Button } from '@/components/ui/button'
import { createJoinDraftEvent, createLeaveDraftEvent } from '@/lib/draft-event'
import { checkNip43Support } from '@/lib/relay'
import { useNostr } from '@/providers/NostrProvider'
import relayMembershipService from '@/services/relay-membership.service'
import { TRelayInfo } from '@/types'
import { LogIn, LogOut, Mail } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import InviteCodeDialog from './InviteCodeDialog'
import JoinDialog from './JoinDialog'

interface RelayMembershipControlProps {
  relayInfo: TRelayInfo
  onMembershipStatusChange?: (status: boolean) => void
}

export default function RelayMembershipControl({
  relayInfo,
  onMembershipStatusChange
}: RelayMembershipControlProps) {
  const { t } = useTranslation()
  const { pubkey, checkLogin, publish } = useNostr()
  const [isMember, setIsMember] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [showJoinDialog, setShowJoinDialog] = useState(false)
  const [showInviteCodeDialog, setShowInviteCodeDialog] = useState(false)
  const supportsNip43 = useMemo(() => checkNip43Support(relayInfo), [relayInfo])

  useEffect(() => {
    if (!supportsNip43 || !pubkey) {
      setIsMember(false)
      return
    }

    const checkMembership = async () => {
      try {
        setIsChecking(true)
        const status = await relayMembershipService.checkMembership(
          relayInfo.url,
          pubkey,
          relayInfo.pubkey
        )
        setIsMember(status)
      } finally {
        setIsChecking(false)
      }
    }

    checkMembership()
  }, [relayInfo.url, relayInfo.pubkey, pubkey, supportsNip43])

  useEffect(() => {
    if (onMembershipStatusChange) {
      onMembershipStatusChange(isMember)
    }
  }, [isMember, onMembershipStatusChange])

  if (!supportsNip43 || isChecking) {
    return null
  }

  const submitJoinRequest = async () => {
    setIsLoading(true)
    try {
      const draftEvent = createJoinDraftEvent('')
      const joinRequestEvent = await publish(draftEvent, {
        specifiedRelayUrls: [relayInfo.url]
      })
      toast.success(t('Join request sent successfully'))
      await relayMembershipService.addNewMember(relayInfo.url, joinRequestEvent.pubkey)
      onMembershipStatusChange?.(true)
    } catch {
      setShowJoinDialog(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGetInviteCodeClick = () => {
    setShowInviteCodeDialog(true)
  }

  const handleLeaveClick = async () => {
    if (!confirm(t('Are you sure you want to leave this relay?'))) {
      return
    }

    setIsLoading(true)
    try {
      const draftEvent = createLeaveDraftEvent()
      const leaveRequestEvent = await publish(draftEvent, {
        specifiedRelayUrls: [relayInfo.url]
      })
      toast.success(t('Leave request sent successfully'))
      await relayMembershipService.removeMember(relayInfo.url, leaveRequestEvent.pubkey)
      setIsMember(false)
    } catch (error: any) {
      const errors = error instanceof AggregateError ? error.errors : [error]
      errors.forEach((err) => {
        toast.error(
          `${t('Failed to send leave request')}: ${err instanceof Error ? err.message : String(err)}`,
          { duration: 10_000 }
        )
        console.error(err)
      })
      return
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {isMember ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            className="w-full"
            onClick={handleGetInviteCodeClick}
            disabled={isLoading}
          >
            <Mail className="w-4 h-4 mr-2" />
            {t('Get Invite Code')}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleLeaveClick}
            disabled={isLoading}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('Leave')}
          </Button>
        </div>
      ) : (
        <Button
          variant="default"
          className="w-full"
          onClick={() => {
            checkLogin(() => submitJoinRequest())
          }}
          disabled={isLoading}
        >
          <LogIn className="w-4 h-4 mr-2" />
          {t('Request to Join Relay')}
        </Button>
      )}

      <JoinDialog
        relayInfo={relayInfo}
        showJoinDialog={showJoinDialog}
        setShowJoinDialog={setShowJoinDialog}
        onMembershipStatusChange={setIsMember}
      />

      <InviteCodeDialog
        relayInfo={relayInfo}
        showInviteCodeDialog={showInviteCodeDialog}
        setShowInviteCodeDialog={setShowInviteCodeDialog}
      />
    </>
  )
}
