import DmInput from '@/components/DmInput'
import DmMessageList from '@/components/DmMessageList'
import Username from '@/components/Username'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import dmRelayService from '@/services/dm-relay.service'
import { Loader2 } from 'lucide-react'
import { nip19 } from 'nostr-tools'
import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const DmConversationPage = forwardRef(
  ({ pubkey: pubkeyOrNpub, index }: { pubkey?: string; index?: number }, ref) => {
    const { t } = useTranslation()
    const [canSendDm, setCanSendDm] = useState<boolean | null>(null)

    let pubkey = pubkeyOrNpub
    if (pubkeyOrNpub?.startsWith('npub')) {
      try {
        const decoded = nip19.decode(pubkeyOrNpub)
        if (decoded.type === 'npub') {
          pubkey = decoded.data
        }
      } catch {
        // Invalid npub, keep original
      }
    }

    useEffect(() => {
      if (!pubkey) return

      const checkDmSupport = async () => {
        try {
          const { hasDmRelays, hasEncryptionKey } = await dmRelayService.checkDmSupport(pubkey!)
          setCanSendDm(hasDmRelays && hasEncryptionKey)
        } catch {
          setCanSendDm(false)
        }
      }

      checkDmSupport()
    }, [pubkey])

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
        title={<Username userId={pubkey} className="truncate" />}
        ref={ref}
        hideTitlebarBottomBorder
      >
        <div className="flex flex-col h-[calc(100vh-3rem)]">
          <DmMessageList otherPubkey={pubkey} />
          {canSendDm === null ? (
            <div className="border-t p-4 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : canSendDm === false ? (
            <div className="border-t p-4 text-center">
              <p className="text-sm text-muted-foreground">
                {t('This user has not set up direct messages yet.')}
              </p>
            </div>
          ) : (
            <DmInput recipientPubkey={pubkey} disabled={!canSendDm} />
          )}
        </div>
      </SecondaryPageLayout>
    )
  }
)
DmConversationPage.displayName = 'DmConversationPage'
export default DmConversationPage
