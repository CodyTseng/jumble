import NotificationList from '@/components/NotificationList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { usePrimaryPage } from '@/PageManager'
import { Bell } from 'lucide-react'
import { forwardRef, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const NotificationListPage = forwardRef((_, ref) => {
  const { current } = usePrimaryPage()
  const firstRenderRef = useRef(true)
  const notificationListRef = useRef<{ refresh: () => void }>(null)

  useEffect(() => {
    if (current === 'notifications' && !firstRenderRef.current) {
      notificationListRef.current?.refresh()
    }
    firstRenderRef.current = false
  }, [current])

  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="notifications"
      titlebar={<NotificationListPageTitlebar />}
      displayScrollToTopButton
    >
      <NotificationList ref={notificationListRef} />
    </PrimaryPageLayout>
  )
})
NotificationListPage.displayName = 'NotificationListPage'
export default NotificationListPage

function NotificationListPageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <Bell />
      <div className="text-lg font-semibold">{t('Notifications')}</div>
    </div>
  )
}
