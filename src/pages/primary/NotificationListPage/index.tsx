import NotificationList from '@/components/NotificationList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { usePrimaryPage } from '@/PageManager'
import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function NotificationListPage() {
  const { current, display } = usePrimaryPage()
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    if (current === 'notifications' && display) {
      setRefreshCount((prev) => prev + 1)
    }
  }, [current, display])

  return (
    <PrimaryPageLayout pageName="notifications" titlebar={<NotificationListPageTitlebar />}>
      <div className="px-4" key={refreshCount}>
        <NotificationList />
      </div>
    </PrimaryPageLayout>
  )
}

function NotificationListPageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <Bell />
      <div className="text-lg font-semibold">{t('Notifications')}</div>
    </div>
  )
}
