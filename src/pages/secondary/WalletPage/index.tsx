import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toRizful } from '@/lib/link'
import { useZap } from '@/providers/ZapProvider'
import { disconnect, launchModal } from '@getalby/bitcoin-connect-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import DefaultZapAmountInput from './DefaultZapAmountInput'
import DefaultZapCommentInput from './DefaultZapCommentInput'
import LightningAddressInput from './LightningAddressInput'
import QuickZapSwitch from './QuickZapSwitch'

const WalletPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { isWalletConnected } = useZap()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Wallet')}>
      <div className="px-4 pt-3 space-y-4">
        {isWalletConnected ? (
          // TODO: alert dialog to confirm disconnecting wallet
          <Button variant="destructive" onClick={() => disconnect()}>
            {t('Disconnect Wallet')}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              className="bg-foreground hover:bg-foreground/90"
              onClick={() => push(toRizful())}
            >
              {t('Start with Rizful Wallet')}
            </Button>
            <Button
              variant="link"
              className="text-muted-foreground hover:text-foreground px-0"
              onClick={() => {
                launchModal()
              }}
            >
              {t('or other wallets')}
            </Button>
          </div>
        )}
        <LightningAddressInput />
        <DefaultZapAmountInput />
        <DefaultZapCommentInput />
        <QuickZapSwitch />
      </div>
    </SecondaryPageLayout>
  )
})
WalletPage.displayName = 'WalletPage'
export default WalletPage
