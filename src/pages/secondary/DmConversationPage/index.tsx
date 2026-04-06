import DmInput from '@/components/DmInput'
import DmMessageList from '@/components/DmMessageList'
import { ExtendedKind } from '@/constants'
import { useFetchProfile } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useSecondaryPage } from '@/PageManager'
import dmService from '@/services/dm.service'
import { TDmMessage } from '@/types'
import { Loader2, RefreshCw } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const DmConversationPage = forwardRef(
  ({ pubkey: pubkeyOrNpub, index }: { pubkey?: string; index?: number }, ref) => {
    const { t } = useTranslation()
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
    const { currentIndex } = useSecondaryPage()
    const active = currentIndex === index

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
      <SecondaryPageLayout index={index} title={profile?.username} ref={ref} noScrollArea>
        <DmMessageList otherPubkey={pubkey} onReply={handleReply} />
        {dmSupportStatus === 'loading' ? (
          <div
            className="flex justify-center border-t"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 14.5px)',
              paddingTop: '14.5px'
            }}
          >
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : dmSupportStatus !== 'supported' ? (
          <div
            className="flex items-center justify-center gap-2 border-t"
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 14.5px)',
              paddingTop: '14.5px'
            }}
          >
            <p className="text-sm text-muted-foreground">
              {dmSupportStatus === 'no_relays'
                ? t('This user has not set up DM relays yet.')
                : t("This user's client does not support NIP-4e encrypted direct messages.")}
            </p>
            <button
              onClick={() => checkDmSupport(true)}
              className="text-muted-foreground hover:text-foreground"
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
            onSent={handleSent}
          />
        )}
      </SecondaryPageLayout>
    )
  }
)
DmConversationPage.displayName = 'DmConversationPage'
export default DmConversationPage
