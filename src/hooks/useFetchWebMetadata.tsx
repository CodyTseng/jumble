import { isElectron } from '@/lib/platform'
import { isInsecureUrl } from '@/lib/url'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import webService from '@/services/web.service'
import { TWebMetadata } from '@/types'
import { useEffect, useState } from 'react'

type WebMetadataState = {
  requestUrl: string
  metadata: TWebMetadata
  isLoading: boolean
}

export function useFetchWebMetadata(url: string, enabled = true) {
  const { allowInsecureConnection } = useUserPreferences()
  const [state, setState] = useState<WebMetadataState>({
    requestUrl: '',
    metadata: {},
    isLoading: false
  })
  const proxyServer = import.meta.env.VITE_PROXY_SERVER
  let requestUrl = url
  // In Electron mode the main process fetches directly (no CORS), so the
  // browser-side proxy rewrite is unnecessary and would defeat the point.
  if (proxyServer && !isElectron()) {
    requestUrl = `${proxyServer}/sites/${encodeURIComponent(url)}`
  }

  useEffect(() => {
    if (!enabled || (!allowInsecureConnection && isInsecureUrl(url))) return

    let ignore = false
    setState({ requestUrl, metadata: {}, isLoading: true })

    webService
      .fetchWebMetadata(requestUrl, url)
      .then((metadata) => {
        if (!ignore) setState({ requestUrl, metadata, isLoading: false })
      })
      .catch(() => {
        if (!ignore) setState({ requestUrl, metadata: {}, isLoading: false })
      })

    return () => {
      ignore = true
    }
  }, [url, requestUrl, enabled, allowInsecureConnection])

  if (!enabled) {
    return { metadata: {}, isLoading: false }
  }

  if (state.requestUrl !== requestUrl) {
    return { metadata: {}, isLoading: true }
  }

  return { metadata: state.metadata, isLoading: state.isLoading }
}
