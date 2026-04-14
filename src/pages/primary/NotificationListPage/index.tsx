import NotificationList from '@/components/NotificationList'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { cn } from '@/lib/utils'
import { usePrimaryPage } from '@/PageManager'
import {
  NotificationUserPreferenceContext,
  useNotificationUserPreference
} from '@/providers/NotificationUserPreferenceProvider'
import localStorage from '@/services/local-storage.service'
import { TPageRef } from '@/types'
import { Bell } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const NotificationListPage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  const { current } = usePrimaryPage()
  const [hideIndirect, setHideIndirect] = useState(localStorage.getHideIndirectNotifications())
  const firstRenderRef = useRef(true)
  const notificationListRef = useRef<{ refresh: () => void }>(null)

  useEffect(() => {
    if (current === 'notifications' && !firstRenderRef.current) {
      notificationListRef.current?.refresh()
    }
    firstRenderRef.current = false
  }, [current])

  const updateHideIndirect = useCallback(
    (enable: boolean) => {
      setHideIndirect(enable)
      localStorage.setHideIndirectNotifications(enable)
    },
    [setHideIndirect]
  )

  return (
    <NotificationUserPreferenceContext.Provider
      value={{
        hideIndirect,
        updateHideIndirect
      }}
    >
      <PrimaryPageLayout
        ref={ref}
        pageName="notifications"
        icon={<Bell />}
        title={t('Notifications')}
        controls={<HideUnrelatedNotificationsToggle />}
        sideWidth="7rem"
        displayScrollToTopButton
      >
        <NotificationList ref={notificationListRef} />
      </PrimaryPageLayout>
    </NotificationUserPreferenceContext.Provider>
  )
})
NotificationListPage.displayName = 'NotificationListPage'
export default NotificationListPage

function HideUnrelatedNotificationsToggle() {
  const { t } = useTranslation()
  const { hideIndirect, updateHideIndirect } = useNotificationUserPreference()

  return (
    <Button
      variant="ghost"
      className={cn(
        'h-10 shrink-0 rounded-xl px-3 [&_svg]:size-5',
        hideIndirect ? 'bg-muted/40 text-foreground' : 'text-muted-foreground'
      )}
      onClick={() => updateHideIndirect(!hideIndirect)}
    >
      {t('Hide indirect')}
    </Button>
  )
}
