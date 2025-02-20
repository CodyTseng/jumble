import { Input } from '@/components/ui/input'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useZap } from '@/providers/ZapProvider'
import { Button as BcButton } from '@getalby/bitcoin-connect-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const WalletPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { defaultZapSats, updateDefaultSats, defaultZapComment, updateDefaultComment } = useZap()
  const [defaultZapAmountInput, setDefaultZapAmountInput] = useState(defaultZapSats)
  const [defaultZapCommentInput, setDefaultZapCommentInput] = useState(defaultZapComment)

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Wallet')}>
      <div className="px-4 pt-2 space-y-4">
        <BcButton />
        <div className="flex justify-between items-center">
          <div>{t('Default zap amount')}</div>
          <Input
            className="w-40"
            value={defaultZapAmountInput}
            onChange={(e) => {
              setDefaultZapAmountInput((pre) => {
                if (e.target.value === '') {
                  return 0
                }
                let num = parseInt(e.target.value, 10)
                if (isNaN(num) || num < 0) {
                  num = pre
                }
                return num
              })
            }}
            onBlur={() => {
              updateDefaultSats(defaultZapAmountInput)
            }}
          />
        </div>
        <div className="flex justify-between items-center">
          <div>{t('Default zap comment')}</div>
          <Input
            className="w-40"
            value={defaultZapCommentInput}
            onChange={(e) => setDefaultZapCommentInput(e.target.value)}
            onBlur={() => {
              updateDefaultComment(defaultZapCommentInput)
            }}
          />
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
WalletPage.displayName = 'WalletPage'
export default WalletPage
