import { SettingsGroup, SettingsPageContainer, SettingsRow } from '@/components/ui/settings'
import { Switch } from '@/components/ui/switch'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import storage from '@/services/local-storage.service'
import systemNotification from '@/services/system-notification'
import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const NotificationSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const [disableNotificationSync, setDisableNotificationSync] = useState(
    storage.getDisableNotificationSync()
  )
  const [systemNotificationsEnabled, setSystemNotificationsEnabled] = useState(
    storage.getSystemNotificationsEnabled()
  )
  const [systemGeneralNotificationsEnabled, setSystemGeneralNotificationsEnabled] = useState(
    storage.getSystemGeneralNotificationsEnabled()
  )
  const [systemDmNotificationsEnabled, setSystemDmNotificationsEnabled] = useState(
    storage.getSystemDmNotificationsEnabled()
  )
  const [systemNotificationsSupported, setSystemNotificationsSupported] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([systemNotification.isSupported(), systemNotification.getPermission()]).then(
      ([supported, permission]) => {
        if (cancelled) return
        setSystemNotificationsSupported(supported)
        if (supported && systemNotificationsEnabled && permission !== 'granted') {
          storage.setSystemNotificationsEnabled(false)
          setSystemNotificationsEnabled(false)
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  const updateSystemNotifications = async (enabled: boolean) => {
    if (!enabled) {
      storage.setSystemNotificationsEnabled(false)
      setSystemNotificationsEnabled(false)
      return
    }

    const permission = await systemNotification.requestPermission()
    if (permission !== 'granted') {
      storage.setSystemNotificationsEnabled(false)
      setSystemNotificationsEnabled(false)
      toast.error(t('Notification permission was not granted'))
      return
    }

    storage.setSystemNotificationsEnabled(true)
    setSystemNotificationsEnabled(true)
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Notifications')}>
      <SettingsPageContainer>
        {systemNotificationsSupported && (
          <SettingsGroup>
            <SettingsRow
              htmlFor="system-notifications"
              title={t('System notifications')}
              description={t('Show notifications while Jumble is running in the background')}
              control={
                <Switch
                  id="system-notifications"
                  checked={systemNotificationsEnabled}
                  onCheckedChange={(checked) => void updateSystemNotifications(checked)}
                />
              }
            />
            {systemNotificationsEnabled && (
              <div className="border-t px-4 pt-3 pb-2">
                <div className="text-muted-foreground mb-1 text-xs font-medium">
                  {t('Notification types')}
                </div>
                <div>
                  <SettingsRow
                    htmlFor="system-general-notifications"
                    title={t('General notifications')}
                    description={t('Mentions, replies, reactions, and zaps')}
                    className="border-b-0 px-0 py-2"
                    control={
                      <Switch
                        id="system-general-notifications"
                        checked={systemGeneralNotificationsEnabled}
                        onCheckedChange={(checked) => {
                          setSystemGeneralNotificationsEnabled(checked)
                          storage.setSystemGeneralNotificationsEnabled(checked)
                        }}
                      />
                    }
                  />
                  <SettingsRow
                    htmlFor="system-dm-notifications"
                    title={t('Direct message notifications')}
                    description={t('New private messages')}
                    className="border-b-0 px-0 py-2"
                    control={
                      <Switch
                        id="system-dm-notifications"
                        checked={systemDmNotificationsEnabled}
                        onCheckedChange={(checked) => {
                          setSystemDmNotificationsEnabled(checked)
                          storage.setSystemDmNotificationsEnabled(checked)
                        }}
                      />
                    }
                  />
                </div>
              </div>
            )}
          </SettingsGroup>
        )}
        <SettingsGroup>
          <SettingsRow
            htmlFor="disable-notification-sync"
            title={t('Do not sync notification read status')}
            description={t('Only update read status locally without publishing to relays')}
            control={
              <Switch
                id="disable-notification-sync"
                checked={disableNotificationSync}
                onCheckedChange={(checked) => {
                  setDisableNotificationSync(checked)
                  storage.setDisableNotificationSync(checked)
                }}
              />
            }
          />
        </SettingsGroup>
      </SettingsPageContainer>
    </SecondaryPageLayout>
  )
})

NotificationSettingsPage.displayName = 'NotificationSettingsPage'
export default NotificationSettingsPage
