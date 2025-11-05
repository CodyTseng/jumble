import { useEffect, useState } from 'react'
import { useWidgets } from '@/providers/WidgetsProvider'
import { cn } from '@/lib/utils'
import { Box } from 'lucide-react'

type BitcoinPrice = {
  usd: number
}

type BlockHeight = number

export default function BitcoinTicker() {
  const { bitcoinTickerAlignment, bitcoinTickerTextSize, bitcoinTickerShowBlockHeight, bitcoinTickerShowSatsMode } = useWidgets()
  const [price, setPrice] = useState<BitcoinPrice | null>(null)
  const [blockHeight, setBlockHeight] = useState<BlockHeight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'
        )
        if (!response.ok) {
          throw new Error('Failed to fetch Bitcoin price')
        }
        const data = await response.json()
        setPrice({
          usd: data.bitcoin.usd
        })
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch price')
      } finally {
        setLoading(false)
      }
    }

    fetchPrice()
    // Refresh price every 60 seconds
    const interval = setInterval(fetchPrice, 60000)

    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!bitcoinTickerShowBlockHeight) {
      return
    }

    const fetchBlockHeight = async () => {
      try {
        const response = await fetch('https://mempool.space/api/blocks/tip/height')
        if (!response.ok) {
          throw new Error('Failed to fetch block height')
        }
        const height = await response.json()
        setBlockHeight(height)
      } catch (err) {
        console.error('Failed to fetch block height:', err)
        // Don't show error for block height, just silently fail
      }
    }

    fetchBlockHeight()
    // Refresh block height every 60 seconds
    const interval = setInterval(fetchBlockHeight, 60000)

    return () => clearInterval(interval)
  }, [bitcoinTickerShowBlockHeight])

  const formatPrice = (price: number) => {
    if (bitcoinTickerShowSatsMode) {
      // Calculate sats per dollar (100,000,000 sats per BTC / price in USD)
      const satsPerDollar = Math.round(100000000 / price)
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(satsPerDollar)
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(price)
  }

  const formatSatsLabel = () => {
    return (
      <>
        <span className="text-muted-foreground !text-sm">
          {' sats'}
        </span>
        <span className="text-muted-foreground !text-sm">
          /$
        </span>
      </>
    )
  }

  const alignmentClass = bitcoinTickerAlignment === 'center' ? 'justify-center' : 'justify-start'
  const textSizeClass = bitcoinTickerTextSize === 'small' ? 'text-lg' : 'text-4xl'

  if (loading) {
    return (
      <div className={cn('flex items-center px-6 py-3', alignmentClass)}>
        <div className="animate-pulse text-sm text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error || !price) {
    return (
      <div className={cn('flex items-center px-6 py-3', alignmentClass)}>
        <div className="text-sm text-red-500">{error || 'Failed to load price'}</div>
      </div>
    )
  }

  return (
    <div
      className={cn('px-6 py-3 flex items-center', alignmentClass)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={cn('font-bold', textSizeClass)}>
        {formatPrice(price.usd)}
        {bitcoinTickerShowSatsMode && formatSatsLabel()}
      </div>
      {bitcoinTickerShowBlockHeight && blockHeight !== null && (
        <div className="ml-auto flex items-center gap-2 text-muted-foreground">
          <Box
            className={cn(
              'h-4 w-4 transition-transform duration-700',
              isHovered && 'rotate-180'
            )}
          />
          <span className="text-sm font-medium">{blockHeight.toLocaleString()}</span>
        </div>
      )}
    </div>
  )
}
