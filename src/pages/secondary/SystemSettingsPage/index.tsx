import DefaultRelaysSetting from '@/components/DefaultRelaysSetting'
import SearchRelaysSetting from '@/components/SearchRelaysSetting'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_FAVICON_URL_TEMPLATE } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import storage from '@/services/local-storage.service'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const SystemSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { faviconUrlTemplate, setFaviconUrlTemplate } = useContentPolicy()
  const [filterOutOnionRelays, setFilterOutOnionRelays] = useState(
    storage.getFilterOutOnionRelays()
  )
  const [allowInsecureConnection, setAllowInsecureConnection] = useState(
    storage.getAllowInsecureConnection()
  )

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('System')}>
      <div className="mt-3 space-y-4">
        <div className="space-y-2 px-4">
          <Label htmlFor="favicon-url" className="text-base font-normal">
            {t('Favicon URL')}
          </Label>
          <Input
            id="favicon-url"
            type="text"
            value={faviconUrlTemplate}
            onChange={(e) => setFaviconUrlTemplate(e.target.value)}
            placeholder={DEFAULT_FAVICON_URL_TEMPLATE}
          />
        </div>
        <div className="flex min-h-9 items-center justify-between px-4">
          <Label htmlFor="filter-out-onion-relays" className="text-base font-normal">
            {t('Filter out onion relays')}
          </Label>
          <Switch
            id="filter-out-onion-relays"
            checked={filterOutOnionRelays}
            onCheckedChange={(checked) => {
              storage.setFilterOutOnionRelays(checked)
              setFilterOutOnionRelays(checked)
            }}
          />
        </div>
        <div className="flex min-h-9 items-center justify-between px-4">
          <Label htmlFor="allow-insecure-connection" className="text-base font-normal">
            <div>{t('Allow insecure connections')}</div>
            <div className="text-muted-foreground">
              {t('Allow insecure connections description')}
            </div>
          </Label>
          <Switch
            id="allow-insecure-connection"
            checked={allowInsecureConnection}
            onCheckedChange={(checked) => {
              storage.setAllowInsecureConnection(checked)
              setAllowInsecureConnection(checked)
            }}
          />
        </div>
        <div className="space-y-2 px-4">
          <DefaultRelaysSetting />
        </div>
        <div className="space-y-2 px-4">
          <SearchRelaysSetting />
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
SystemSettingsPage.displayName = 'SystemSettingsPage'
export default SystemSettingsPage
