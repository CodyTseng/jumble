import { registerPlugin } from '@capacitor/core'
import { isAndroid } from './platform'
import { getSafeExternalUrl } from './url'
import { t } from 'i18next'
import { toast } from 'sonner'

const System = registerPlugin<{
  writeClipboard(options: { text: string }): Promise<void>
  openBatterySettings(): Promise<void>
  openUrl(options: { url: string }): Promise<void>
}>('JumbleSystem')

export async function copyText(text: string): Promise<void> {
  if (isAndroid()) await System.writeClipboard({ text })
  else await navigator.clipboard.writeText(text)
}

/** Web links only; payment schemes are handled by the native WebView client. */
export function openExternalUrl(url: string): void {
  const safe = getSafeExternalUrl(url)
  if (!safe) return
  if (isAndroid()) {
    void System.openUrl({ url: safe }).catch((error) => {
      toast.error(t('Something went wrong'), { description: error.message })
    })
  } else window.open(safe, '_blank', 'noopener,noreferrer')
}

export async function openBatterySettings(): Promise<void> {
  if (isAndroid()) await System.openBatterySettings()
}
