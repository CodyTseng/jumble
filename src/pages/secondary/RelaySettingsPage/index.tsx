import FavoriteRelaysSetting from '@/components/FavoriteRelaysSetting'
import MailboxSetting from '@/components/MailboxSetting'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IS_COMMUNITY_MODE } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const RelaySettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const [tabValue, setTabValue] = useState('favorite-relays')

  useEffect(() => {
    switch (window.location.hash) {
      case '#mailbox':
        setTabValue('mailbox')
        break
      case '#favorite-relays':
        setTabValue('favorite-relays')
        break
    }
  }, [])

  if (IS_COMMUNITY_MODE) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Relay settings')}>
        <div className="space-y-4 px-4 py-3">
          <MailboxSetting />
        </div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Relay settings')}>
      <Tabs value={tabValue} onValueChange={setTabValue} className="space-y-4 px-4 py-3">
        <TabsList>
          <TabsTrigger value="favorite-relays">{t('Favorite Relays')}</TabsTrigger>
          <TabsTrigger value="mailbox">{t('Read & Write Relays')}</TabsTrigger>
        </TabsList>
        <TabsContent value="favorite-relays">
          <FavoriteRelaysSetting />
        </TabsContent>
        <TabsContent value="mailbox">
          <MailboxSetting />
        </TabsContent>
      </Tabs>
    </SecondaryPageLayout>
  )
})
RelaySettingsPage.displayName = 'RelaySettingsPage'
export default RelaySettingsPage
