import { isInsecureUrl } from '@/lib/url'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import blossomService from '@/services/blossom.service'
import { useCallback, useEffect, useState } from 'react'

const FALLBACK_TIMEOUT_MS = 5000

function computeInitial(src: string, pubkey: string | undefined, allowInsecureConnection: boolean) {
  if (!allowInsecureConnection && isInsecureUrl(src)) {
    return { url: undefined, error: true }
  }
  if (!pubkey) {
    return { url: src, error: false }
  }
  return { url: blossomService.peekValidUrl(src, pubkey), error: false }
}

export function useBlossomUrl(src: string, pubkey?: string) {
  const { allowInsecureConnection } = useUserPreferences()
  const [{ url, error }, setState] = useState(() =>
    computeInitial(src, pubkey, allowInsecureConnection)
  )

  useEffect(() => {
    if (!allowInsecureConnection && isInsecureUrl(src)) {
      setState({ url: undefined, error: true })
      return
    }

    if (!pubkey) {
      setState({ url: src, error: false })
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return
      setState({ url: src, error: false })
    }, FALLBACK_TIMEOUT_MS)

    blossomService.getValidUrl(src, pubkey).then((validUrl) => {
      if (cancelled) return
      setState({ url: validUrl, error: false })
      clearTimeout(timer)
    })

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [src, pubkey, allowInsecureConnection])

  const handleError = useCallback(async () => {
    const nextUrl = await blossomService.tryNextUrl(src)
    if (nextUrl) {
      setState({ url: nextUrl, error: false })
    } else {
      setState((prev) => ({ url: prev.url, error: true }))
    }
  }, [src])

  const markSuccess = useCallback(() => {
    blossomService.markAsSuccess(src, url || src)
  }, [src, url])

  return { url, error, handleError, markSuccess }
}
