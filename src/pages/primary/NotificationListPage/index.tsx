import HideUntrustedContentButton from '@/components/HideUntrustedContentButton'
import NotificationList from '@/components/NotificationList'
import PinButton from '@/components/PinButton'
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
    <div className="flex gap-2 items-center justify-between h-full pl-3">
      <div className="flex items-center gap-2 [&_svg]:text-muted-foreground">
        <Bell />
        <div className="text-lg font-semibold" style={{ fontSize: `var(--title-font-size, 18px)` }}>{t('Notifications')}</div>
      </div>
      <div className="flex gap-1 items-center">
        <PinButton column={{ type: 'notifications' }} size="titlebar-icon" />
        <HideUntrustedContentButton type="notifications" size="titlebar-icon" />
      </div>
    </div>
  )
}
