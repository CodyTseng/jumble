import { getSafeExternalUrl, isInsecureUrl } from '@/lib/url'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'

export function useWebPreviewPolicy() {
  const { autoLoadMedia } = useContentPolicy()
  const { allowInsecureConnection, showLinkPreviews } = useUserPreferences()

  return (url: string, mustLoad = false) =>
    Boolean(getSafeExternalUrl(url)) &&
    (showLinkPreviews || mustLoad) &&
    (autoLoadMedia || mustLoad) &&
    (allowInsecureConnection || !isInsecureUrl(url))
}
