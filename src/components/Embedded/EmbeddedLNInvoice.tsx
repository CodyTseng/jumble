import { Button } from '@/components/ui/button'
import { formatAmount, getInvoiceDetails } from '@/lib/lightning'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import lightning from '@/services/lightning.service'
import { Loader, Zap } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export function EmbeddedLNInvoice({ invoice, className }: { invoice: string; className?: string }) {
  const { t } = useTranslation()
  const { checkLogin, pubkey } = useNostr()
  const [paying, setPaying] = useState(false)

  const { amount, description } = useMemo(() => {
    return getInvoiceDetails(invoice)
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
      className={cn('flex max-w-sm cursor-default flex-col gap-3 rounded-lg border p-3', className)}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <Zap className="h-5 w-5 text-yellow-400" />
        <div className="text-sm font-semibold">{t('Lightning Invoice')}</div>
      </div>
      {description && (
        <div className="wrap-break-word text-sm text-muted-foreground">{description}</div>
      )}
      <div className="text-lg font-bold">
        {formatAmount(amount)} {t('sats')}
      </div>
      <Button onClick={handlePayClick}>
        {paying && <Loader className="h-4 w-4 animate-spin" />}
        {t('Pay')}
      </Button>
    </div>
  )
}
