import { registerPlugin } from '@capacitor/core'
import { isAndroid } from './platform'
import { t } from 'i18next'
import { toast } from 'sonner'

const Files = registerPlugin<{
  saveText(options: { filename: string; text: string }): Promise<{ saved: boolean }>
}>('JumbleFiles')

/** Android uses the system Save As picker; web keeps its synchronous download gesture. */
export async function downloadTextFile(filename: string, text: string): Promise<boolean> {
  if (isAndroid()) {
    const notification = toast.loading(t('Saving...'))
    try {
      const { saved } = await Files.saveText({ filename, text })
      if (saved) toast.success(t('Saved'), { id: notification })
      else toast.dismiss(notification)
      return saved
    } catch {
      toast.error(t('Something went wrong'), { id: notification })
      return false
    }
  }
  const blob = new Blob([text], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return true
}
