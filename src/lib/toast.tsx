import { X } from 'lucide-react'
import { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { randomString } from './random'

function LoadingToastContent({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { t } = useTranslation()

  return (
    <>
      {children}
      <button type="button" data-close-button aria-label={t('Close')} onClick={onClose}>
        <X size={12} />
      </button>
    </>
  )
}

// Sonner omits its native close button while a promise toast is loading.
// Only replace the loading content so result messages and unwrap() keep their behavior.
export const toastPromise: typeof toast.promise = (promise, options) => {
  if (
    options?.loading === undefined ||
    options.closeButton === false ||
    options.dismissible === false
  ) {
    return toast.promise(promise, options)
  }

  const id = options.id ?? randomString()
  return toast.promise(promise, {
    ...options,
    id,
    loading: (
      <LoadingToastContent
        onClose={() => {
          const currentToast = toast.getToasts().find((item) => item.id === id)
          toast.dismiss(id)
          if (currentToast && 'title' in currentToast) {
            currentToast.onDismiss?.(currentToast)
          }
        }}
      >
        {options.loading}
      </LoadingToastContent>
    )
  })
}
