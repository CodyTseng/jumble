import { Button } from '@/components/ui/button'
import { toWallet } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useSparkWallet } from '@/providers/SparkWalletProvider'
import { Eye, EyeOff, Wallet } from 'lucide-react'
import { useState } from 'react'

export default function WalletButton({ collapse }: { collapse: boolean }) {
  const { push } = useSecondaryPage()
  const { connected, balance } = useSparkWallet()
  const [hideBalance, setHideBalance] = useState(false)

  if (!connected) return null

  const balanceSats = balance || 0
  const balanceUsd = (balanceSats * 0.001217).toFixed(2) // Rough BTC price estimation

  const handleWalletClick = () => {
    push(toWallet())
  }

  const toggleHideBalance = (e: React.MouseEvent) => {
    e.stopPropagation()
    setHideBalance(!hideBalance)
  }

  if (collapse) {
    return (
      <Button
        variant="ghost"
        onClick={handleWalletClick}
        className="w-12 h-12 p-2 flex items-center justify-center bg-transparent text-foreground hover:text-accent-foreground rounded-lg shadow-none"
        title="Wallet"
      >
        <Wallet className="size-5" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      onClick={handleWalletClick}
      className="w-full h-auto p-3 flex flex-col items-start bg-muted/50 hover:bg-muted rounded-lg shadow-none gap-1"
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Wallet className="size-4" />
          <span className="text-xs font-medium text-muted-foreground">Wallet</span>
        </div>
        <button
          onClick={toggleHideBalance}
          className="p-1 hover:bg-background rounded transition-colors"
          title={hideBalance ? 'Show balance' : 'Hide balance'}
        >
          {hideBalance ? (
            <EyeOff className="size-3.5 text-muted-foreground" />
          ) : (
            <Eye className="size-3.5 text-muted-foreground" />
          )}
        </button>
      </div>
      <div className="flex flex-col items-start w-full">
        {hideBalance ? (
          <span className="text-lg font-bold">••••</span>
        ) : (
          <>
            <span className="text-lg font-bold">{balanceSats.toLocaleString()} sats</span>
            <span className="text-xs text-muted-foreground">${balanceUsd}</span>
          </>
        )}
      </div>
    </Button>
  )
}
