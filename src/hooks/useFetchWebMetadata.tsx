import { isInsecureUrl } from '@/lib/url'
import storage from '@/services/local-storage.service'
import webService from '@/services/web.service'
import { TWebMetadata } from '@/types'
import { useEffect, useState } from 'react'

export function useFetchWebMetadata(url: string) {
  const [metadata, setMetadata] = useState<TWebMetadata>({})
  const proxyServer = import.meta.env.VITE_PROXY_SERVER
  if (proxyServer) {
    url = `${proxyServer}/sites/${encodeURIComponent(url)}`
  }

  useEffect(() => {
    if (!storage.getAllowInsecureConnection() && isInsecureUrl(url)) return

    webService.fetchWebMetadata(url).then((metadata) => setMetadata(metadata))
  }, [url])

  return metadata
}
