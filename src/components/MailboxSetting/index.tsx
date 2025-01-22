import { Button } from '@/components/ui/button'
import { normalizeUrl } from '@/lib/url'
import { useNostr } from '@/providers/NostrProvider'
import { TMailboxRelay, TMailboxRelayScope } from '@/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import CalculateOptimalReadRelaysButton from './CalculateOptimalReadRelaysButton'
import MailboxRelay from './MailboxRelay'
import NewMailboxRelayInput from './NewMailboxRelayInput'
import SaveButton from './SaveButton'

export default function MailboxSetting() {
  const { t } = useTranslation()
  const { pubkey, relayList, checkLogin } = useNostr()
  const [relays, setRelays] = useState<TMailboxRelay[]>([])
  const [hasChange, setHasChange] = useState(false)

  useEffect(() => {
    if (!relayList) return

    setRelays(relayList.originalRelays)
  }, [relayList])

  if (!pubkey) {
    return (
      <div className="flex flex-col w-full items-center">
        <Button size="lg" onClick={() => checkLogin()}>
          {t('Login to set')}
        </Button>
      </div>
    )
  }

  if (!relayList) {
    return <div className="text-center text-sm text-muted-foreground">{t('loading...')}</div>
  }

  const changeMailboxRelayScope = (url: string, scope: TMailboxRelayScope) => {
    setRelays((prev) => prev.map((r) => (r.url === url ? { ...r, scope } : r)))
    setHasChange(true)
  }

  const removeMailboxRelay = (url: string) => {
    setRelays((prev) => prev.filter((r) => r.url !== url))
    setHasChange(true)
  }

  const saveNewMailboxRelay = (url: string) => {
    if (url === '') return null
    const normalizedUrl = normalizeUrl(url)
    if (relays.some((r) => r.url === normalizedUrl)) {
      return t('Relay already exists')
    }
    setRelays([...relays, { url: normalizedUrl, scope: 'both' }])
    setHasChange(true)
    return null
  }

  const mergeRelays = (newRelays: TMailboxRelay[]) => {
    setRelays((pre) => {
      return [...pre, ...newRelays.filter((r) => !pre.some((pr) => pr.url === r.url))]
    })
    setHasChange(true)
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground space-y-1">
        <div>{t('read relays description')}</div>
        <div>{t('write relays description')}</div>
        <div>{t('read & write relays notice')}</div>
      </div>
      <CalculateOptimalReadRelaysButton mergeRelays={mergeRelays} />
      <SaveButton mailboxRelays={relays} hasChange={hasChange} setHasChange={setHasChange} />
      <div className="space-y-2">
        {relays.map((relay) => (
          <MailboxRelay
            key={relay.url}
            mailboxRelay={relay}
            changeMailboxRelayScope={changeMailboxRelayScope}
            removeMailboxRelay={removeMailboxRelay}
          />
        ))}
      </div>
      <NewMailboxRelayInput saveNewMailboxRelay={saveNewMailboxRelay} />
    </div>
  )
}
