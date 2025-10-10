import { Loader2 } from 'lucide-react'
import { Payment } from '@breeztech/breez-sdk-spark/web'

interface SparkPaymentsListProps {
  payments: Payment[]
  loading: boolean
}

export default function SparkPaymentsList({ payments, loading }: SparkPaymentsListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin size-6 text-muted-foreground" />
      </div>
    )
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <p className="text-muted-foreground">No payments yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Payments will appear here after you send or receive
        </p>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString()
  }

  const formatAmount = (amountSats: number, paymentType: string) => {
    const prefix = paymentType === 'sent' ? '-' : '+'
    const color = paymentType === 'sent' ? 'text-red-600' : 'text-green-600'
    return <span className={color}>{prefix}{amountSats.toLocaleString()} sats</span>
  }

  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      {payments.map((payment, index) => (
        <div
          key={payment.id || index}
          className="p-3 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {formatAmount(payment.amountSats, payment.paymentType)}
                <span className="text-xs text-muted-foreground capitalize">
                  {payment.paymentType}
                </span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${
                  payment.status === 'complete'
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                    : payment.status === 'pending'
                    ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                    : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
                }`}>
                  {payment.status}
                </span>
              </div>
              {payment.description && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {payment.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {formatDate(payment.createdAt)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
