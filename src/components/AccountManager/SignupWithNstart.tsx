import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import { useTranslation } from 'react-i18next'
import { usePopup } from './PopupProvider'

// TODO: Improve the design of this component
export default function SignupWithNstart({
  back,
  onLoginSuccess
}: {
  back: () => void
  onLoginSuccess: () => void
}) {
  const { popupWindow } = usePopup()
  const { pubkey } = useNostr()
  const { t } = useTranslation()

  if (pubkey) {
    return (
      <div className="flex flex-col items-center space-y-2">
        <div className="text-3xl font-semibold text-primary">{t('Welcome!')}</div>
        <div className="text-muted-foreground text-sm">
          {t('Your are now logged in. Feel free to explore the app.')}
        </div>
        <Button onClick={onLoginSuccess} size="lg">
          {t('Ok, let me explore Nostr')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className="text-2xl font-semibold text-primary">
        {t('Signup in progress, ')}
        <Button
          variant="link"
          className="text-2xl font-semibold p-0"
          onClick={() => popupWindow?.focus()}
        >
          {t('check the popup')}
        </Button>
      </div>
      <Button
        variant="link"
        onClick={() => {
          popupWindow?.close()
          back()
        }}
      >
        {t('Cancel the Signup')}
      </Button>
    </div>
  )
}
