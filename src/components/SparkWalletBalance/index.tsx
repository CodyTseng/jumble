import { useSecondaryPage } from '@/PageManager'
import { useZap } from '@/providers/ZapProvider'
import { Wallet, Zap } from 'lucide-react'
import { Button } from '../ui/button'

/**
 * SparkWalletBalance - Display Spark wallet balance in header
 *
 * Shows balance when Spark wallet is connected
 * Clicking opens the Spark wallet page
 */
export function SparkWalletBalance() {
  const { isSparkConnected, sparkWalletInfo } = useZap()
  const { push } = useSecondaryPage()

  if (!isSparkConnected || !sparkWalletInfo) {
    return null
  }

  const balanceSats = sparkWalletInfo.balanceSats || 0

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-2 h-8 px-2 text-xs"
      onClick={() => push({ type: 'secondary', name: 'spark-test' })}
      title="Open Spark wallet"
    >
      <Wallet className="size-4" />
      <span className="font-mono font-semibold">
        {balanceSats.toLocaleString()}
      </span>
      <Zap className="size-3 text-yellow-500" />
    </Button>
  )
}
