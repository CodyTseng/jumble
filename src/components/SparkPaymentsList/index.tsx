import { Loader2 } from 'lucide-react'
import { Payment } from '@breeztech/breez-sdk-spark/web'

interface SparkPaymentsListProps {
  payments: Payment[]
  loading: boolean
}

const SentIcon = () => <img src="/sent_icon.svg" alt="Sent" className="size-5" />
const ReceivedIcon = () => <img src="/received_icon.svg" alt="Received" className="size-5" />

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
    // Check if timestamp is in seconds (Unix timestamp) or milliseconds
    // If the timestamp is less than 10^12, it's in seconds (before year 2286)
    const milliseconds = timestamp < 10000000000 ? timestamp * 1000 : timestamp
    const date = new Date(milliseconds)
    return date.toLocaleString()
  }

  const formatAmount = (amount: bigint | undefined, fees: bigint | undefined, paymentType: string) => {
    const amountSats = amount ? Number(amount) : 0
    const feeSats = fees ? Number(fees) : 0
    const prefix = paymentType === 'send' ? '-' : '+'
    const color = paymentType === 'send' ? 'text-red-600' : 'text-green-600'

    return (
      <span className={color}>
        {prefix}{amountSats.toLocaleString()} sat{amountSats !== 1 ? 's' : ''}
        {feeSats > 0 && (
          <span className="text-xs text-muted-foreground">
            {' + '}{feeSats.toLocaleString()} sat{feeSats !== 1 ? 's' : ''} fee
          </span>
        )}
      </span>
    )
  }

  return (
    <div className="space-y-1 max-h-[500px] overflow-y-auto">
      {payments.map((payment, index) => (
        <div
          key={payment.id || index}
          className="p-2 border rounded bg-card hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center justify-between gap-3">
            {/* Icon and Amount - Left side */}
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {payment.paymentType === 'send' ? <SentIcon /> : <ReceivedIcon />}
              {formatAmount(payment.amount, payment.fees, payment.paymentType)}
            </div>

            {/* Date and Status - Right side */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">
                {formatDate(payment.timestamp)}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                payment.status === 'completed'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : payment.status === 'pending'
                  ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                  : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
              }`}>
                {payment.status}
              </span>
            </div>
          </div>

          {/* Description - Full width on second line if exists */}
          {payment.details && 'description' in payment.details && (
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {payment.details.description}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}
