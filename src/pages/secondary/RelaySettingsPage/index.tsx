import MailboxSetting from '@/components/MailboxSetting'
import RelaySetsSetting from '@/components/RelaySetsSetting'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTranslation } from 'react-i18next'

export default function RelaySettingsPage({ index }: { index?: number }) {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout index={index} title={t('Relay settings')}>
      <Tabs defaultValue="relay-sets" className="px-4 space-y-4">
        <TabsList>
          <TabsTrigger value="relay-sets">{t('Relay Sets')}</TabsTrigger>
          <TabsTrigger value="mailbox">{t('Read & Write Relays')}</TabsTrigger>
        </TabsList>
        <TabsContent value="relay-sets">
          <RelaySetsSetting />
        </TabsContent>
        <TabsContent value="mailbox">
          <MailboxSetting />
        </TabsContent>
      </Tabs>
    </SecondaryPageLayout>
  )
}
