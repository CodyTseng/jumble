import { useSecondaryPage } from '@/PageManager'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toRizful, toSparkTest } from '@/lib/link'
import { useZap } from '@/providers/ZapProvider'
import { useSparkWallet } from '@/providers/SparkWalletProvider'
import { disconnect, launchModal } from '@getalby/bitcoin-connect-react'
import { Info } from 'lucide-react'
import { forwardRef, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import DefaultZapAmountInput from './DefaultZapAmountInput'
import DefaultZapCommentInput from './DefaultZapCommentInput'
import LightningAddressInput from './LightningAddressInput'
import QuickZapSwitch from './QuickZapSwitch'

const WalletPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { isWalletConnected, walletInfo } = useZap()
  const { connected: sparkConnected, connecting: sparkConnecting } = useSparkWallet()
  const hasAutoNavigated = useRef(false)

  // Auto-navigate to Spark wallet if it's connected (only once on mount)
  useEffect(() => {
    if (sparkConnected && !isWalletConnected && !hasAutoNavigated.current) {
      console.log('[WalletPage] Spark wallet detected, navigating to Spark page')
      hasAutoNavigated.current = true
      push(toSparkTest())
    }
  }, [sparkConnected, isWalletConnected, push])

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Wallet')}>
      {isWalletConnected ? (
        <div className="px-4 pt-3 space-y-4">
          <div>
            {walletInfo?.node.alias && (
              <div className="mb-2">
                {t('Connected to')} <strong>{walletInfo.node.alias}</strong>
              </div>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">{t('Disconnect Wallet')}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('Are you absolutely sure?')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('You will not be able to send zaps to others.')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => disconnect()}>
                    {t('Disconnect')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <DefaultZapAmountInput />
          <DefaultZapCommentInput />
          <QuickZapSwitch />
          <LightningAddressInput />
        </div>
      ) : (
        <div className="px-4 pt-3 space-y-4">
          <div>
            <div className="flex items-center gap-1">
              <Button
                className="bg-foreground hover:bg-foreground/90 flex items-center gap-2"
                onClick={() => push(toSparkTest())}
              >
                <img src="/spark-logo.svg" alt="Spark" className="w-5 h-5" />
                {sparkConnecting ? 'Setting up Spark...' : sparkConnected ? 'Open Spark Wallet ✓' : 'Try Breez SDK + Spark'}
              </Button>
              <Button
                variant="link"
                size="icon"
                className="text-muted-foreground hover:text-foreground px-0"
                onClick={() => window.open('https://breez.technology/spark/', '_blank')}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {sparkConnecting
                ? 'Initializing Spark wallet...'
                : sparkConnected
                  ? 'Your Spark wallet is ready'
                  : 'Experimental Spark wallet integration'}
            </p>
          </div>
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => push(toRizful())}>
                {t('Start with a Rizful Vault')}
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
          </div>
        </div>
      )}
    </SecondaryPageLayout>
  )
})
WalletPage.displayName = 'WalletPage'
export default WalletPage
