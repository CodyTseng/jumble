import RelaySettings from '@/components/RelaySettings'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTranslation } from 'react-i18next'

export default function RelaySettingsPage({ index }: { index?: number }) {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout index={index} titlebarContent={t('Relay settings')}>
      <div className="px-4">
        <RelaySettings hideTitle />
      </div>
    </SecondaryPageLayout>
  )
}
