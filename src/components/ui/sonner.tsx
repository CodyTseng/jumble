import { useTheme } from '@/providers/ThemeProvider'
import { useTranslation } from 'react-i18next'
import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { themeSetting } = useTheme()
  const { t, i18n } = useTranslation()

  return (
    <Sonner
      theme={themeSetting === 'pure-black' ? 'dark' : themeSetting}
      className="toaster group"
      richColors
      closeButton
      dir={i18n.dir()}
      offset={{
        top: 20,
        right: 20,
        left: 20,
        bottom: 'calc(env(safe-area-inset-bottom) + 3.5rem)'
      }}
      mobileOffset={{
        top: 20,
        right: 20,
        left: 20,
        // Raise bottom toasts above the bottom navigation bar (h-12 = 3rem)
        // plus the device safe-area inset, so they never cover it on mobile.
        bottom: 'calc(env(safe-area-inset-bottom) + 3.5rem)'
      }}
      toastOptions={{
        closeButtonAriaLabel: t('Close'),
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground'
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
