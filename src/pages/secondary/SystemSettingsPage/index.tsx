import DefaultRelaysSetting from '@/components/DefaultRelaysSetting'
import SearchRelaysSetting from '@/components/SearchRelaysSetting'
import { Input } from '@/components/ui/input'
import {
  SettingsGroup,
  SettingsPageContainer,
  SettingsRow
} from '@/components/ui/settings'
import { Switch } from '@/components/ui/switch'
import UpdateSettings from '@/components/UpdateSettings'
import { DEFAULT_BLOSSOM_CACHE_SERVER_URL, DEFAULT_FAVICON_URL_TEMPLATE } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { isElectron } from '@/lib/platform'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import blossomCache from '@/services/blossom-cache.service'
import storage from '@/services/local-storage.service'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const SystemSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { faviconUrlTemplate, setFaviconUrlTemplate } = useContentPolicy()
  const { allowInsecureConnection, updateAllowInsecureConnection } = useUserPreferences()
  const [filterOutOnionRelays, setFilterOutOnionRelays] = useState(
    storage.getFilterOutOnionRelays()
  )
  const [blossomCacheUrl, setBlossomCacheUrl] = useState(storage.getBlossomCacheServerUrl())
  const [blossomCacheEnabled, setBlossomCacheEnabled] = useState(
    storage.getBlossomCacheServerEnabled()
  )
  const [checkingBlossomCache, setCheckingBlossomCache] = useState(false)

  const handleBlossomCacheUrlChange = (url: string) => {
    setBlossomCacheUrl(url)
    storage.setBlossomCacheServerUrl(url)
    // Editing the URL invalidates the previous reachability check, so disable
    // until the user turns it on again and the new URL is verified.
    if (storage.getBlossomCacheServerEnabled()) {
      blossomCache.disable()
      setBlossomCacheEnabled(false)
    }
  }

  const handleBlossomCacheToggle = async (checked: boolean) => {
    if (!checked) {
      blossomCache.disable()
      setBlossomCacheEnabled(false)
      return
    }

    setCheckingBlossomCache(true)
    const enabled = await blossomCache.enable(blossomCacheUrl)
    setCheckingBlossomCache(false)
    if (enabled) {
      setBlossomCacheEnabled(true)
    } else {
      toast.error(t('Cannot reach the Blossom cache server'))
    }
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('System')}>
      <SettingsPageContainer>
        {isElectron() && (
          <SettingsGroup title={t('Updates')}>
            <UpdateSettings />
          </SettingsGroup>
        )}

        <SettingsGroup title={t('Connection')}>
          <SettingsRow
            htmlFor="filter-out-onion-relays"
            title={t('Filter out onion relays')}
            control={
              <Switch
                id="filter-out-onion-relays"
                checked={filterOutOnionRelays}
                onCheckedChange={(checked) => {
                  storage.setFilterOutOnionRelays(checked)
                  setFilterOutOnionRelays(checked)
                }}
              />
            }
          />
          <SettingsRow
            htmlFor="allow-insecure-connection"
            title={t('Allow insecure connections')}
            description={t('Allow insecure connections description')}
            control={
              <Switch
                id="allow-insecure-connection"
                checked={allowInsecureConnection}
                onCheckedChange={updateAllowInsecureConnection}
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup
          title={t('Blossom cache server')}
          description={t('Blossom cache server description')}
        >
          <SettingsRow
            layout="stacked"
            title={t('Server URL')}
          >
            <Input
              id="blossom-cache-server-url"
              type="text"
              value={blossomCacheUrl}
              onChange={(e) => handleBlossomCacheUrlChange(e.target.value)}
              placeholder={DEFAULT_BLOSSOM_CACHE_SERVER_URL}
            />
          </SettingsRow>
          <SettingsRow
            htmlFor="blossom-cache-server-enabled"
            title={t('Enable')}
            control={
              <Switch
                id="blossom-cache-server-enabled"
                checked={blossomCacheEnabled}
                disabled={checkingBlossomCache}
                onCheckedChange={handleBlossomCacheToggle}
              />
            }
          />
        </SettingsGroup>

        <SettingsGroup>
          <div className="px-4 py-3">
            <DefaultRelaysSetting />
          </div>
        </SettingsGroup>

        <SettingsGroup>
          <div className="px-4 py-3">
            <SearchRelaysSetting />
          </div>
        </SettingsGroup>

        <SettingsGroup title={t('Web display')}>
          <SettingsRow
            layout="stacked"
            title={t('Favicon URL')}
            description={t('Template URL used to fetch website favicons')}
          >
            <Input
              id="favicon-url"
              type="text"
              value={faviconUrlTemplate}
              onChange={(e) => setFaviconUrlTemplate(e.target.value)}
              placeholder={DEFAULT_FAVICON_URL_TEMPLATE}
            />
          </SettingsRow>
        </SettingsGroup>
      </SettingsPageContainer>
    </SecondaryPageLayout>
  )
})
SystemSettingsPage.displayName = 'SystemSettingsPage'
export default SystemSettingsPage
