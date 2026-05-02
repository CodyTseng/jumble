import { isElectron } from '@/lib/platform'
import { isInsecureUrl } from '@/lib/url'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import webService from '@/services/web.service'
import { TWebMetadata } from '@/types'
import { useEffect, useState } from 'react'

export function useFetchWebMetadata(url: string) {
  const { allowInsecureConnection } = useUserPreferences()
  const [metadata, setMetadata] = useState<TWebMetadata>({})
  const proxyServer = import.meta.env.VITE_PROXY_SERVER
  // In Electron mode the main process fetches directly (no CORS), so the
  // browser-side proxy rewrite is unnecessary and would defeat the point.
  if (proxyServer && !isElectron()) {
    url = `${proxyServer}/sites/${encodeURIComponent(url)}`
  }

  useEffect(() => {
    if (!allowInsecureConnection && isInsecureUrl(url)) return

    webService.fetchWebMetadata(url).then((metadata) => setMetadata(metadata))
  }, [url, allowInsecureConnection])

  return metadata
}
