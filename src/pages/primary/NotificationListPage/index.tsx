import NotificationList from '@/components/NotificationList'
import { Button } from '@/components/ui/button'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import {
  NotificationUserPreferenceContext,
  useNotificationUserPreference
} from '@/providers/NotificationUserPreferenceProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import localStorage from '@/services/local-storage.service'
import { TPageRef } from '@/types'
import { BellIcon } from '@phosphor-icons/react'
import { Eye, EyeOff } from 'lucide-react'
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
  const { isSmallScreen } = useScreenSize()
  const { hideIndirect, updateHideIndirect } = useNotificationUserPreference()

  return (
    <Button
      variant="toggle"
      size={isSmallScreen ? 'titlebar-icon' : 'default'}
      aria-pressed={hideIndirect}
      aria-label={t('Hide indirect')}
      title={hideIndirect ? t('Indirect notifications hidden') : t('Indirect notifications shown')}
      className={isSmallScreen ? undefined : 'h-10 shrink-0 rounded-xl px-3 [&_svg]:size-5'}
      onClick={() => updateHideIndirect(!hideIndirect)}
    >
      {hideIndirect ? <EyeOff /> : <Eye />}
      {!isSmallScreen && t('Hide indirect')}
    </Button>
  )
}
