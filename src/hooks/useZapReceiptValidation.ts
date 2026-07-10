import lightning from '@/services/lightning.service'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function useZapReceiptValidation(event: Event) {
  const [result, setResult] = useState<{ eventId: string; valid: boolean } | null>(null)

  useEffect(() => {
    if (event.kind !== kinds.Zap) return

    let cancelled = false
    lightning
      .validateZapReceipt(event)
      .then((valid) => {
        if (!cancelled) setResult({ eventId: event.id, valid })
      })
      .catch(() => {
        if (!cancelled) setResult({ eventId: event.id, valid: false })
      })

    return () => {
      cancelled = true
    }
  }, [event])

  if (event.kind !== kinds.Zap) return true
  return result?.eventId === event.id ? result.valid : null
}
