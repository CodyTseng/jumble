import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useZap } from '@/providers/ZapProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function DefaultZapAmountInput() {
  const { t } = useTranslation()
  const { defaultZapSats, updateDefaultSats } = useZap()
  const [defaultZapAmountInput, setDefaultZapAmountInput] = useState(defaultZapSats)

  return (
    <div className="w-full space-y-1">
      <Label htmlFor="default-zap-amount-input">{t('Default zap amount')}</Label>
      <div className="flex w-full items-center gap-2">
        <Input
          id="default-zap-amount-input"
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
    </div>
  )
}
