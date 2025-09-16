import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useNostr } from '@/providers/NostrProvider'
import { connectNWC } from '@getalby/bitcoin-connect'
import { ExternalLink, Loader2 } from 'lucide-react'
import { forwardRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const RIZFUL_URL = 'https://rizful.com'
const RIZFUL_SIGNUP_URL = `${RIZFUL_URL}/create-account`
const RIZFUL_GET_TOKEN_URL = `${RIZFUL_URL}/nostr_onboarding_auth_token/get_token`
const RIZFUL_TOKEN_EXCHANGE_URL = `${RIZFUL_URL}/nostr_onboarding_auth_token/post_for_secrets`

const RizfulPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [token, setToken] = useState('')
  const [connecting, setConnecting] = useState(false)

  const connectRizful = async () => {
    setConnecting(true)
    try {
      const r = await fetch(RIZFUL_TOKEN_EXCHANGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          secret_code: token.trim(),
          nostr_public_key: pubkey
        })
      })

      if (!r.ok) {
        const errorText = await r.text()
        throw new Error(errorText || 'Exchange failed')
      }

      const j = (await r.json()) as {
        nwc_uri?: string
        lightning_address?: string
      }

      if (j.nwc_uri) {
        connectNWC(j.nwc_uri)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setConnecting(false)
    }
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Rizful Wallet')}>
      <div className="px-4 pt-3 space-y-6">
        <div className="space-y-2">
          <div className="font-semibold">{t('New to Rizful?')}</div>
          <Button
            className="bg-lime-500 hover:bg-lime-500/90 w-64"
            onClick={() => window.open(RIZFUL_SIGNUP_URL, '_blank')}
          >
            {t('Sign up for Rizful')} <ExternalLink />
          </Button>
          <div className="text-sm text-muted-foreground">
            {t('If you already have a Rizful account, you can skip this step.')}
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-semibold">{t('Get your one-time code')}</div>
          <Button
            className="bg-sky-500 hover:bg-sky-500/90 w-64"
            onClick={() => openPopup(RIZFUL_GET_TOKEN_URL, 'rizful_codes')}
          >
            {t('Get code')}
            <ExternalLink />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="font-semibold">{t('Connect to your Rizful Wallet')}</div>
          <Input
            placeholder={t('Paste your one-time code here')}
            value={token}
            onChange={(e) => {
              setToken(e.target.value.trim())
            }}
          />
          <Button
            className="bg-orange-500 hover:bg-orange-500/90 w-64"
            disabled={!token || connecting}
            onClick={() => connectRizful()}
          >
            {connecting && <Loader2 className="animate-spin" />}
            {t('Connect')}
          </Button>
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
RizfulPage.displayName = 'RizfulPage'
export default RizfulPage

function openPopup(url: string, name: string, width = 520, height = 700) {
  const left = Math.max((window.screenX || 0) + (window.innerWidth - width) / 2, 0)
  const top = Math.max((window.screenY || 0) + (window.innerHeight - height) / 2, 0)

  return window.open(
    url,
    name,
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,menubar=no,toolbar=no,location=no,status=no`
  )
}
