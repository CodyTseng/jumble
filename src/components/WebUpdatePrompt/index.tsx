import { isElectron } from '@/lib/platform'
import { watchWebUpdate } from '@/lib/web-update'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const TOAST_ID = 'web-update-ready'

export default function WebUpdatePrompt() {
  const { t } = useTranslation()

  useEffect(() => {
    if (isElectron() || !import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let applying = false
    let disposed = false
    const show = () => {
      if (disposed) return
      toast(t('A new version of Jumble is ready'), {
        id: TOAST_ID,
        duration: Infinity,
        action: {
          label: t('Reload'),
          onClick: (event) => {
            // Keep the offer available if confirmation is cancelled or activation fails.
            event.preventDefault()
            if (applying) return
            if (
              !window.confirm(t('Save any unfinished work before reloading to update. Reload now?'))
            ) {
              return
            }
            applying = true
            void updater.apply().catch((error) => {
              if (disposed) return
              console.error('[web-update] activation failed:', error)
              applying = false
              toast.error(t('Try again later or check your connection'))
              show()
            })
          }
        }
      })
    }
    const updater = watchWebUpdate(show, (error) => {
      // Background checks can fail offline. Do not interrupt reading for them.
      console.warn('[web-update] check failed:', error)
    })
    return () => {
      disposed = true
      updater.dispose()
      toast.dismiss(TOAST_ID)
    }
  }, [t])

  return null
}
