import { Button } from '@/components/ui/button'
import { toWallet } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useSparkWallet } from '@/providers/SparkWalletProvider'
import { useCurrencyPreferences } from '@/providers/CurrencyPreferencesProvider'
import { useCurrencyConversion } from '@/hooks/useCurrencyConversion'
import { formatFiatAmount } from '@/lib/currency'
import { Eye, EyeOff, Wallet } from 'lucide-react'

export default function WalletButton({ collapse }: { collapse: boolean }) {
  const { push } = useSecondaryPage()
  const { connected, balance } = useSparkWallet()
  const { displayCurrency, isBalanceHidden, toggleBalanceVisibility } = useCurrencyPreferences()
  const { fiatValue, isLoading } = useCurrencyConversion(balance || 0, displayCurrency)

  if (!connected) return null

  const balanceSats = balance || 0

  const handleWalletClick = () => {
    push(toWallet())
  }

  const toggleHideBalance = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleBalanceVisibility()
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
          title={isBalanceHidden ? 'Show balance' : 'Hide balance'}
        >
          {isBalanceHidden ? (
            <EyeOff className="size-3.5 text-muted-foreground" />
          ) : (
            <Eye className="size-3.5 text-muted-foreground" />
          )}
        </button>
      </div>
      <div className="flex flex-col items-start w-full">
        {isBalanceHidden ? (
          <span className="text-lg font-bold">••••</span>
        ) : (
          <>
            {displayCurrency === 'SATS' ? (
              <span className="text-lg font-bold">{balanceSats.toLocaleString()} sats</span>
            ) : isLoading || fiatValue === null ? (
              <span className="text-lg font-bold">...</span>
            ) : (
              <>
                <span className="text-lg font-bold">{formatFiatAmount(fiatValue, displayCurrency)}</span>
                <span className="text-xs text-muted-foreground">{balanceSats.toLocaleString()} sats</span>
              </>
            )}
          </>
        )}
      </div>
    </Button>
  )
}
