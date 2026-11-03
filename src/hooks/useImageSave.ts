import {
  downloadImage,
  prepareImageForSave,
  shouldPrepareImageForShare,
  type PreparedImage,
  type SaveAs
} from '@/lib/save-image'
import { isAndroid } from '@/lib/platform'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export function useImageSave(url: string | undefined, enabled: boolean) {
  const { t } = useTranslation()
  const saving = useRef(false)
  const [prepared, setPrepared] = useState<{ url: string; image: PreparedImage }>()

  useEffect(() => {
    if (!enabled || !url || !shouldPrepareImageForShare()) return

    const controller = new AbortController()
    prepareImageForSave(url, controller.signal)
      .then((image) => setPrepared({ url, image }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setPrepared(undefined)
      })

    return () => controller.abort()
  }, [enabled, url])

  const preparedImage = prepared && prepared.url === url ? prepared.image : undefined

  return useCallback(
    (saveAs: SaveAs) => {
      if (!url) return
      if (!isAndroid()) {
        void downloadImage(url, preparedImage, saveAs)
        return
      }
      if (saving.current) return
      saving.current = true
      const notification = toast.loading(t('Saving...'))
      void downloadImage(url, preparedImage, saveAs)
        .then(() => toast.success(t('Saved'), { id: notification }))
        .catch((error: unknown) => {
          console.error('[native] image save failed:', error)
          toast.error(t('Something went wrong'), {
            id: notification,
            description: error instanceof Error ? error.message : undefined
          })
        })
        .finally(() => {
          saving.current = false
        })
    },
    [preparedImage, url, t]
  )
}
