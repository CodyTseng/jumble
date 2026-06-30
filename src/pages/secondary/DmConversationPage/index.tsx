import DmInput from '@/components/DmInput'
import DmMessageList from '@/components/DmMessageList'
import UserAvatar from '@/components/UserAvatar'
import { ExtendedKind } from '@/constants'
import { useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { usePrimaryPage, useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import dmService from '@/services/dm.service'
import encryptionKeyService from '@/services/encryption-key.service'
import { TDmMessage } from '@/types'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Info, KeyRound, Loader2, RefreshCw } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const DmConversationPage = forwardRef(
  ({ pubkey: pubkeyOrNpub, index }: { pubkey?: string; index?: number }, ref) => {
    const { t } = useTranslation()
    const { pubkey: accountPubkey } = useNostr()
    const { navigate: navigatePrimary } = usePrimaryPage()
    const { profile } = useFetchProfile(pubkeyOrNpub)
    const [dmSupportStatus, setDmSupportStatus] = useState<
      'loading' | 'supported' | 'no_relays' | 'no_encryption_key'
    >('loading')
    const [replyTo, setReplyTo] = useState<{
      id: string
      content: string
      senderPubkey: string
      tags?: string[][]
    } | null>(null)
    const [scrollToMessageRequest, setScrollToMessageRequest] = useState<{
      id: string
      nonce: number
    } | null>(null)
    const { currentIndex } = useSecondaryPage()
    const active = currentIndex === index

    // Whether the current account is missing a usable encryption key (e.g. the key
    // was rotated on another device). While missing, sending/receiving is blocked
    // and the conversation is covered by a guidance overlay.
    const [accountKeyMissing, setAccountKeyMissing] = useState(false)
    useEffect(() => {
      if (!accountPubkey) {
        setAccountKeyMissing(false)
        return
      }
      setAccountKeyMissing(!encryptionKeyService.hasEncryptionKey(accountPubkey))

      // dmService.reconcileEncryptionKey already decided how to handle the key;
      // 'needs_sync' means this device must resync, 'adopted' means another tab of
      // this browser rotated it and localStorage already holds it.
      const unsubKeyChanged = dmService.onEncryptionKeyChanged((result) => {
        setAccountKeyMissing(result === 'needs_sync')
      })
      // dmService.init() runs once a key is (re)synced; re-check at that point.
      const unsubLoading = dmService.onLoadingChanged(() => {
        setAccountKeyMissing(!encryptionKeyService.hasEncryptionKey(accountPubkey))
      })
      return () => {
        unsubKeyChanged()
        unsubLoading()
      }
    }, [accountPubkey])

    const handleReply = useCallback((message: TDmMessage) => {
      const isFile = message.decryptedRumor?.kind === ExtendedKind.RUMOR_FILE
      setReplyTo({
        id: message.id,
        content: isFile
          ? dmService.getFilePreviewContent(message.decryptedRumor?.tags)
          : message.content,
        senderPubkey: message.senderPubkey,
        tags: message.decryptedRumor?.tags
      })
    }, [])

    const handleCancelReply = useCallback(() => {
      setReplyTo(null)
    }, [])

    const handleSent = useCallback(() => {
      setReplyTo(null)
    }, [])

    const handleReplyPreviewClick = useCallback(() => {
      if (!replyTo) return
      setScrollToMessageRequest({ id: replyTo.id, nonce: Date.now() })
    }, [replyTo])

    const pubkey = useMemo(() => {
      if (pubkeyOrNpub?.startsWith('npub')) {
        try {
          const decoded = nip19.decode(pubkeyOrNpub)
          if (decoded.type === 'npub') {
            return decoded.data
          }
        } catch {
          // Invalid npub, keep original
        }
      }
      return pubkeyOrNpub
    }, [pubkeyOrNpub])

    const checkDmSupport = useCallback(
      async (skipCache = false) => {
        if (!pubkey) return
        setDmSupportStatus('loading')
        try {
          const { hasDmRelays, hasEncryptionKey } = await dmService.checkDmSupport(
            pubkey,
            skipCache
          )
          if (!hasDmRelays) {
            setDmSupportStatus('no_relays')
          } else if (!hasEncryptionKey) {
            setDmSupportStatus('no_encryption_key')
          } else {
            setDmSupportStatus('supported')
          }
        } catch {
          setDmSupportStatus('no_relays')
        }
      },
      [pubkey]
    )

    useEffect(() => {
      checkDmSupport()
    }, [checkDmSupport])

    useEffect(() => {
      if (!pubkey || !active) return

      const promise = dmService.subscribeRecipientEncryptionKey(pubkey, () => {
        setDmSupportStatus('supported')
      })

      return () => {
        promise.then((subscription) => {
          subscription?.close()
        })
      }
    }, [pubkey, active])

    if (!pubkey) {
      return (
        <SecondaryPageLayout index={index} title={t('Conversation')} ref={ref}>
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">{t('Invalid user')}</p>
          </div>
        </SecondaryPageLayout>
      )
    }

    return (
      <SecondaryPageLayout
        index={index}
        title={profile?.username}
        controls={<UserAvatar userId={pubkey} size="small" className="me-2" />}
        ref={ref}
        noScrollArea
      >
        <div className="relative flex min-h-0 flex-1 flex-col">
          <DmMessageList
            otherPubkey={pubkey}
            onReply={handleReply}
            scrollToMessageRequest={scrollToMessageRequest}
          />
          {dmSupportStatus === 'loading' ? (
            <div
              className="flex justify-center border-t"
              style={{
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 14.5px)',
                paddingTop: '14.5px'
              }}
            >
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : dmSupportStatus !== 'supported' ? (
            <div
              className="flex items-center justify-center gap-2 border-t px-4"
              style={{
                paddingBottom: 'calc(env(safe-area-inset-bottom) + 14.5px)',
                paddingTop: '14.5px'
              }}
            >
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="text-muted-foreground hover:text-foreground flex min-w-0 items-center gap-1.5 text-sm"
                    aria-label={t('Details')}
                  >
                    <Info className="h-4 w-4 shrink-0" />
                    <span className="truncate">
                      {dmSupportStatus === 'no_relays'
                        ? t('No DM relays')
                        : t('Encrypted DM unavailable')}
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" className="max-w-xs text-sm">
                  {dmSupportStatus === 'no_relays'
                    ? t('This user has not set up DM relays yet.')
                    : t("This user's client does not support NIP-4e encrypted direct messages.")}
                </PopoverContent>
              </Popover>
              <button
                onClick={() => checkDmSupport(true)}
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label={t('Refresh')}
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <DmInput
              recipientPubkey={pubkey}
              disabled={dmSupportStatus !== 'supported'}
              replyTo={replyTo}
              onCancelReply={handleCancelReply}
              onReplyClick={handleReplyPreviewClick}
              onSent={handleSent}
            />
          )}
          {accountKeyMissing && (
            <div className="bg-background/80 absolute inset-0 z-20 flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-card flex w-full max-w-sm flex-col items-center gap-4 rounded-lg border p-6 text-center shadow-lg">
                <div className="bg-muted rounded-full p-3">
                  <KeyRound className="text-muted-foreground h-6 w-6" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-semibold">{t('Encryption key out of sync')}</h3>
                  <p className="text-muted-foreground text-sm">
                    {t(
                      'Your DM encryption key was updated on another device or client. Sync it to continue this conversation.'
                    )}
                  </p>
                </div>
                <Button className="w-full" onClick={() => navigatePrimary('dms')}>
                  {t('Sync encryption key')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </SecondaryPageLayout>
    )
  }
)
DmConversationPage.displayName = 'DmConversationPage'
export default DmConversationPage
