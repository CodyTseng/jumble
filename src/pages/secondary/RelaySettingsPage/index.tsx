import MailboxSetting from '@/components/MailboxSetting'
import FavoriteRelaysSetting from '@/components/FavoriteRelaysSetting'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Relay settings')}>
      <Tabs value={tabValue} onValueChange={setTabValue} className="px-4 pb-4 space-y-4">
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
