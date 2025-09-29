import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { createProfileDraftEvent } from '@/lib/draft-event'
import { isEmail } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useZap } from '@/providers/ZapProvider'
import { connectNWC, WebLNProviders } from '@getalby/bitcoin-connect'
import { Check, CheckCircle2, Copy, ExternalLink, Loader2 } from 'lucide-react'
import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const RIZFUL_URL = 'https://rizful.com'
const RIZFUL_SIGNUP_URL = `${RIZFUL_URL}/create-account`
const RIZFUL_GET_TOKEN_URL = `${RIZFUL_URL}/nostr_onboarding_auth_token/get_token`
const RIZFUL_TOKEN_EXCHANGE_URL = `${RIZFUL_URL}/nostr_onboarding_auth_token/post_for_secrets`

const RizfulPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey, profile, profileEvent, publish, updateProfileEvent } = useNostr()
  const { provider } = useZap()
  const [token, setToken] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [connected, setConnected] = useState(false)
  const [copiedLightningAddress, setCopiedLightningAddress] = useState(false)
  const [lightningAddress, setLightningAddress] = useState('')

  useEffect(() => {
    if (provider instanceof WebLNProviders.NostrWebLNProvider) {
      const lud16 = provider.client.lud16
      const domain = lud16?.split('@')[1]
      if (domain !== 'rizful.com') return

      if (lud16) {
        setConnected(true)
        setLightningAddress(lud16)
      }
    }
  }, [provider])

  const updateUserProfile = async (address: string) => {
    try {
      if (address === profile?.lightningAddress) {
        return
      }

      const profileContent = profileEvent ? JSON.parse(profileEvent.content) : {}
      if (isEmail(address)) {
        profileContent.lud16 = address
      } else if (address.startsWith('lnurl')) {
        profileContent.lud06 = address
      } else {
        throw new Error(t('Invalid Lightning Address'))
      }

      if (!profileContent.nip05) {
        profileContent.nip05 = address
      }

      const profileDraftEvent = createProfileDraftEvent(
        JSON.stringify(profileContent),
        profileEvent?.tags
      )
      const newProfileEvent = await publish(profileDraftEvent)
      await updateProfileEvent(newProfileEvent)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    }
  }

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
      if (j.lightning_address) {
        updateUserProfile(j.lightning_address)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : String(e))
    } finally {
      setConnecting(false)
    }
  }

  if (connected) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={t('Rizful Vault')}>
        <div className="px-4 pt-3 space-y-6 flex flex-col items-center">
          <CheckCircle2 className="size-40 fill-green-400 text-background" />
          <div className="font-semibold text-2xl">{t('Rizful Vault connected!')}</div>
          <div className="text-center text-sm text-muted-foreground">
            {t('You can now use your Rizful Vault to zap your favorite notes and creators.')}
          </div>
          {lightningAddress && (
            <div className="flex flex-col items-center gap-2">
              <div>{t('Your Lightning Address')}:</div>
              <div
                className="font-semibold text-lg rounded-lg px-4 py-1 flex justify-center items-center gap-2 cursor-pointer hover:bg-accent/80"
                onClick={() => {
                  navigator.clipboard.writeText(lightningAddress)
                  setCopiedLightningAddress(true)
                  setTimeout(() => setCopiedLightningAddress(false), 2000)
                }}
              >
                {lightningAddress}{' '}
                {copiedLightningAddress ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </div>
            </div>
          )}
        </div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Rizful Vault')}>
      <div className="px-4 pt-3 space-y-6">
        <div className="space-y-2">
          <div className="font-semibold">1. {t('New to Rizful?')}</div>
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
          <div className="font-semibold">2. {t('Get your one-time code')}</div>
          <Button
            className="bg-orange-500 hover:bg-orange-500/90 w-64"
            onClick={() => openPopup(RIZFUL_GET_TOKEN_URL, 'rizful_codes')}
          >
            {t('Get code')}
            <ExternalLink />
          </Button>
        </div>

        <div className="space-y-2">
          <div className="font-semibold">3. {t('Connect to your Rizful Vault')}</div>
          <Input
            placeholder={t('Paste your one-time code here')}
            value={token}
            onChange={(e) => {
              setToken(e.target.value.trim())
            }}
          />
          <Button
            className="bg-sky-500 hover:bg-sky-500/90 w-64"
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
