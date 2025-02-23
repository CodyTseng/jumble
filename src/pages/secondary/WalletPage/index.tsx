import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { Button as BcButton } from '@getalby/bitcoin-connect-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import DefaultZapAmountInput from './DefaultZapAmountInput'
import DefaultZapCommentInput from './DefaultZapCommentInput'
import LightningAddressInput from './LightningAddressInput'
import QuickZapSwitch from './QuickZapSwitch'

const WalletPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Wallet')}>
      <div className="px-4 pt-2 space-y-4">
        <BcButton />
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
