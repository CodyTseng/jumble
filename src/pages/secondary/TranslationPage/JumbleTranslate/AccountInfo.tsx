import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { SettingsGroup } from '@/components/ui/settings'
import { JUMBLE_API_BASE_URL } from '@/constants'
import { useNostr } from '@/providers/NostrProvider'
import { Check, Copy, Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useJumbleTranslateAccount } from './JumbleTranslateAccountProvider'
import RegenerateApiKeyButton from './RegenerateApiKeyButton'
import TopUp from './TopUp'

export function AccountInfo() {
  const { t } = useTranslation()
  const { pubkey, startLogin } = useNostr()
  const { account } = useJumbleTranslateAccount()

  useEffect(() => {
    if (account) {
      // Trigger a re-render when the account changes
      setAccount(account);
    }
  }, [account])
  const [showApiKey, setShowApiKey] = useState(false)
  const [copied, setCopied] = useState(false)

  if (!pubkey) {
    return (
      <div className="flex justify-center">
        <Button onClick={() => startLogin()}>{t('Login')}</Button>
      </div>
    )
  }

  return (
    <>
      <SettingsGroup title="Jumble">
        <div className="space-y-4 p-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t('Balance')}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold leading-none">
                {account?.balance.toLocaleString() ?? '0'}
              </span>
              <span className="text-sm text-muted-foreground">{t('characters')}</span>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="jumble-api-key" className="text-sm">
              {t('API key')}
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="jumble-api-key"
                type={showApiKey ? 'text' : 'password'}
                value={account?.api_key ?? ''}
                readOnly
                className="flex-1 font-mono"
              />
              <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <Eye /> : <EyeOff />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={!account?.api_key}
                onClick={() => {
                  if (!account?.api_key) return
                  navigator.clipboard.writeText(account.api_key)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 4000)
                }}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
              <RegenerateApiKeyButton />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('jumbleTranslateApiKeyDescription', {
                serviceUrl: new URL('/v1/translation', JUMBLE_API_BASE_URL).toString()
              })}
            </p>
          </div>
        </div>
      </SettingsGroup>

      <TopUp />
    </>
  )
}
