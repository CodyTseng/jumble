import NotificationList from '@/components/NotificationList'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useTranslation } from 'react-i18next'

export default function NotificationListPage({ index }: { index?: number }) {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout index={index} titlebarContent={t('notifications')}>
      <div className="max-sm:px-4">
        <NotificationList />
      </div>
    </SecondaryPageLayout>
  )
}
