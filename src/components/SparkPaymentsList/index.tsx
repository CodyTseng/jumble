import { ChevronDown, ChevronRight, Copy, Loader2, RefreshCw } from 'lucide-react'
import { Payment } from '@breeztech/breez-sdk-spark/web'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface SparkPaymentsListProps {
  payments: Payment[]
  loading: boolean
  onRefreshPayment?: (paymentId: string) => Promise<void>
  isBalanceHidden?: boolean
}

const SentIcon = () => <img src="/sent_icon.svg" alt="Sent" className="size-5" />
const ReceivedIcon = () => <img src="/received_icon.svg" alt="Received" className="size-5" />

export default function SparkPaymentsList({ payments, loading, onRefreshPayment, isBalanceHidden = false }: SparkPaymentsListProps) {
  const [expandedPayments, setExpandedPayments] = useState<Set<string>>(new Set())
  const [refreshingPayments, setRefreshingPayments] = useState<Set<string>>(new Set())

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

  const toggleExpanded = (paymentId: string) => {
    setExpandedPayments(prev => {
      const newSet = new Set(prev)
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId)
      } else {
        newSet.add(paymentId)
      }
      return newSet
    })
  }

  const handleRefreshPayment = async (paymentId: string) => {
    if (!onRefreshPayment) return

    setRefreshingPayments(prev => new Set(prev).add(paymentId))
    try {
      await onRefreshPayment(paymentId)
      toast.success('Payment status refreshed')
    } catch (error) {
      toast.error('Failed to refresh payment')
    } finally {
      setRefreshingPayments(prev => {
        const newSet = new Set(prev)
        newSet.delete(paymentId)
        return newSet
      })
    }
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const formatDate = (timestamp: number) => {
    // Check if timestamp is in seconds (Unix timestamp) or milliseconds
    // If the timestamp is less than 10^12, it's in seconds (before year 2286)
    const milliseconds = timestamp < 10000000000 ? timestamp * 1000 : timestamp
    const date = new Date(milliseconds)
    return date.toLocaleString()
  }

  const formatPendingDuration = (timestamp: number) => {
    const milliseconds = timestamp < 10000000000 ? timestamp * 1000 : timestamp
    const now = Date.now()
    const diffMs = now - milliseconds
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))

    if (diffDays > 0) {
      return `${diffDays}d ${diffHours}h`
    }
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`
    }
    return `${diffMinutes}m`
  }

  const isPendingTooLong = (timestamp: number) => {
    const milliseconds = timestamp < 10000000000 ? timestamp * 1000 : timestamp
    const now = Date.now()
    const diffMinutes = Math.floor((now - milliseconds) / (1000 * 60))
    return diffMinutes > 10 // More than 10 minutes is unusual
  }

  const formatAmount = (amount: bigint | undefined, fees: bigint | undefined, paymentType: string) => {
    if (isBalanceHidden) {
      return <span className="text-muted-foreground">••••</span>
    }

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
      {payments.map((payment, index) => {
        const isExpanded = expandedPayments.has(payment.id)
        const isRefreshing = refreshingPayments.has(payment.id)

        return (
          <div
            key={payment.id || index}
            className="p-2 border rounded bg-card hover:bg-accent/50 transition-colors"
          >
            <div
              className="flex items-center justify-between gap-3 cursor-pointer"
              onClick={() => toggleExpanded(payment.id)}
            >
              {/* Icon and Amount - Left side */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {isExpanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
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
            {payment.details && 'description' in payment.details && payment.details.description && (
              <p className="text-xs text-muted-foreground mt-1 truncate ml-8">
                {payment.details.description}
              </p>
            )}

            {/* Expanded Details */}
            {isExpanded && (
              <div className="mt-3 pt-3 border-t text-xs ml-8">
                {/* Warning for payments pending too long */}
                {payment.status === 'pending' && isPendingTooLong(payment.timestamp) && (
                  <div className="text-muted-foreground space-y-1 mb-3">
                    <p className="text-yellow-600 dark:text-yellow-400">
                      Payment pending for {formatPendingDuration(payment.timestamp)}
                    </p>
                    <p>
                      This is taking longer than expected. The payment may be stuck due to routing issues.
                      It will eventually fail and funds will be returned, or it may complete if a route is found.
                    </p>
                  </div>
                )}

                <div className="grid gap-3">
                  {/* Payment ID */}
                  <div className="flex items-center justify-between gap-2 min-h-6">
                    <span className="text-muted-foreground font-medium">Payment ID:</span>
                    <div className="flex items-center gap-1 min-w-0">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded truncate max-w-[200px]">
                        {payment.id}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          copyToClipboard(payment.id, 'Payment ID')
                        }}
                      >
                        <Copy className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="flex items-center justify-between gap-2 min-h-6">
                    <span className="text-muted-foreground font-medium">Method:</span>
                    <span className="text-xs">{payment.method}</span>
                  </div>

                  {/* Lightning Details */}
                  {payment.details && payment.details.type === 'lightning' && (() => {
                    const lightningDetails = payment.details.type === 'lightning' ? payment.details : null
                    if (!lightningDetails) return null

                    return (
                      <>
                        <div className="flex items-center justify-between gap-2 min-h-6">
                          <span className="text-muted-foreground font-medium">Payment Hash:</span>
                          <div className="flex items-center gap-1 min-w-0">
                            <code className="text-xs bg-muted px-1 py-0.5 rounded truncate max-w-[200px]">
                              {lightningDetails.paymentHash}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="size-6 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                                copyToClipboard(lightningDetails.paymentHash, 'Payment hash')
                              }}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </div>
                        </div>

                        {lightningDetails.invoice && (
                          <div className="flex items-center justify-between gap-2 min-h-6">
                            <span className="text-muted-foreground font-medium">Invoice:</span>
                            <div className="flex items-center gap-1 min-w-0">
                              <code className="text-xs bg-muted px-1 py-0.5 rounded truncate max-w-[200px]">
                                {lightningDetails.invoice.substring(0, 20)}...
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(lightningDetails.invoice, 'Invoice')
                                }}
                              >
                                <Copy className="size-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {lightningDetails.preimage && (
                          <div className="flex items-center justify-between gap-2 min-h-6">
                            <span className="text-muted-foreground font-medium">Preimage:</span>
                            <div className="flex items-center gap-1 min-w-0">
                              <code className="text-xs bg-muted px-1 py-0.5 rounded truncate max-w-[200px]">
                                {lightningDetails.preimage}
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(lightningDetails.preimage!, 'Preimage')
                                }}
                              >
                                <Copy className="size-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {/* Spark Invoice Details */}
                  {payment.details && payment.details.type === 'spark' && (() => {
                    const sparkDetails = payment.details.type === 'spark' ? payment.details : null
                    if (!sparkDetails?.invoiceDetails) return null

                    return (
                      <>
                        {sparkDetails.invoiceDetails.invoice && (
                          <div className="flex items-center justify-between gap-2 min-h-6">
                            <span className="text-muted-foreground font-medium">Invoice:</span>
                            <div className="flex items-center gap-1 min-w-0">
                              <code className="text-xs bg-muted px-1 py-0.5 rounded truncate max-w-[200px]">
                                {sparkDetails.invoiceDetails.invoice.substring(0, 20)}...
                              </code>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="size-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  copyToClipboard(sparkDetails.invoiceDetails!.invoice, 'Invoice')
                                }}
                              >
                                <Copy className="size-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}

                  {/* Refresh Button for Pending Payments */}
                  {payment.status === 'pending' && onRefreshPayment && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRefreshPayment(payment.id)
                      }}
                      disabled={isRefreshing}
                    >
                      <RefreshCw className={`size-3 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                      {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
