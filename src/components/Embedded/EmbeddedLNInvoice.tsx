import { formatAmount, getAmountFromInvoice } from '@/lib/lightning'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useToast } from '@/hooks'
import { Loader, Zap } from 'lucide-react'
import lightning from '@/services/lightning.service'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

export function EmbeddedLNInvoice({ invoice }: { invoice: string }) {
  const { t } = useTranslation()
  const { toast } = useToast()
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
      toast({
        title: t('Lightning payment failed'),
        description: (error as Error).message,
        variant: 'destructive'
      })
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
      className={cn(
        'border rounded-lg p-4 bg-card text-card-foreground shadow-sm',
        'flex flex-col gap-3 my-2 max-w-sm'
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold text-sm">Lightning Invoice</h3>
      </div>
      <div className="text-lg font-bold">
        {formatAmount(amount)}
      </div>
      <Button 
        className={cn(
          'w-full px-4 py-2 rounded-md font-medium text-sm',
          'bg-purple-600 hover:bg-purple-700 text-white',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-colors duration-200',
          'flex items-center justify-center gap-2'
        )}
        onClick={handlePayClick}
      >
        {paying ? (
          <>
            <Loader className="w-4 h-4 animate-spin" />
            Paying...
          </>
        ) : (
          'Pay'
        )}
      </Button>
    </div>
  )
}
