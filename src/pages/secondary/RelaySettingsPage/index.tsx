import RelaySettings from '@/components/RelaySettings'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTranslation } from 'react-i18next'

export default function RelaySettingsPage() {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout titlebarContent={t('Relay settings')}>
      <div className="max-sm:px-4">
        <RelaySettings hideTitle />
      </div>
    </SecondaryPageLayout>
  )
}
