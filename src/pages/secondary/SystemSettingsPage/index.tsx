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

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('System')}>
      <div className="space-y-4 mt-3">
        <div className="px-4 space-y-2">
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
        <div className="flex justify-between items-center px-4 min-h-9">
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
      </div>
    </SecondaryPageLayout>
  )
})
SystemSettingsPage.displayName = 'SystemSettingsPage'
export default SystemSettingsPage
