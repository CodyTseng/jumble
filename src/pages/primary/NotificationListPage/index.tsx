import HideUntrustedContentButton from '@/components/HideUntrustedContentButton'
import NotificationList from '@/components/NotificationList'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { usePrimaryPage } from '@/PageManager'
import { TPageRef } from '@/types'
import { Bell } from 'lucide-react'
import { forwardRef, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const NotificationListPage = forwardRef<TPageRef>((_, ref) => {
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
    <div className="flex gap-2 items-center justify-between h-full pl-3">
      <div className="flex items-center gap-2">
        <Bell />
        <div className="text-lg font-semibold">{t('Notifications')}</div>
      </div>
      <HideUntrustedContentButton type="notifications" size="titlebar-icon" />
    </div>
  )
}
