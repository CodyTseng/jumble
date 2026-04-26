import NotificationList from '@/components/NotificationList'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { cn } from '@/lib/utils'
import {
  NotificationUserPreferenceContext,
  useNotificationUserPreference
} from '@/providers/NotificationUserPreferenceProvider'
import localStorage from '@/services/local-storage.service'
import { TPageRef } from '@/types'
import { BellIcon } from '@phosphor-icons/react'
import { forwardRef, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

const NotificationListPage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  const [hideIndirect, setHideIndirect] = useState(localStorage.getHideIndirectNotifications())

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
        icon={<BellIcon />}
        title={t('Notifications')}
        controls={<HideUnrelatedNotificationsToggle />}
        sideWidth="7rem"
        displayScrollToTopButton
      >
        <NotificationList />
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
