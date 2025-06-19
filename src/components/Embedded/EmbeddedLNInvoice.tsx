import { Button } from '@/components/ui/button'
import { formatAmount, getAmountFromInvoice } from '@/lib/lightning'
import { useNostr } from '@/providers/NostrProvider'
import lightning from '@/services/lightning.service'
import { Loader, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export function EmbeddedLNInvoice({ invoice }: { invoice: string }) {
  const { t } = useTranslation()
  const { checkLogin, pubkey } = useNostr()
  const [paying, setPaying] = useState(false)

  const amount = useMemo(() => {
    return getAmountFromInvoice(invoice)
  }, [invoice])

  const handlePay = async () => {
    try {
      if (!pubkey) {
        throw new Error('You need to be logged in to zap')
      }
      setPaying(true)
      const invoiceResult = await lightning.payInvoice(invoice)
      // user canceled
      if (!invoiceResult) {
        return
      }
    } catch (error) {
      toast.error(t('Lightning payment failed') + ': ' + (error as Error).message)
    } finally {
      setPaying(false)
    }
  }

  const handlePayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(() => handlePay())
  }

  return (
    <div
      className="p-2 sm:p-3 border rounded-lg cursor-default flex flex-col gap-3 max-w-sm"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-400" />
        <div className="font-semibold text-sm">{t('Lightning Invoice')}</div>
      </div>
      <div className="text-lg font-bold">
        {formatAmount(amount)} {t('sats')}
      </div>
      <Button onClick={handlePayClick}>
        {paying && <Loader className="w-4 h-4 animate-spin" />}
        {t('Pay')}
      </Button>
    </div>
  )
}
