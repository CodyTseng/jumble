import { getFiatValue } from '@getalby/lightning-tools'
import { useEffect, useState } from 'react'

/**
 * Hook to convert satoshis to fiat currency
 * Uses @getalby/lightning-tools for conversion rates
 */
export function useCurrencyConversion(sats: number, currency: string) {
  const [fiatValue, setFiatValue] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (currency === 'SATS') {
      setFiatValue(null)
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    getFiatValue({ satoshi: sats, currency })
      .then((value: number) => {
        if (!cancelled) {
          setFiatValue(value)
          setIsLoading(false)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err)
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [sats, currency])

  return { fiatValue, isLoading, error }
}
