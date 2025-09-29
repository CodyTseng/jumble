import { toWallet } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import storage from '@/services/local-storage.service'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function CreateWalletGuideToast() {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { profile } = useNostr()

  useEffect(() => {
    if (
      profile &&
      !profile.lightningAddress &&
      !storage.hasShownCreateWalletGuideToast(profile.pubkey)
    ) {
      toast(t('Set up your wallet to send and receive sats!'), {
        action: {
          label: t('Set up'),
          onClick: () => push(toWallet())
        }
      })
      storage.markCreateWalletGuideToastAsShown(profile.pubkey)
    }
  }, [profile])

  return null
}
