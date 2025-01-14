import { Button } from '@/components/ui/button'
import { normalizeUrl } from '@/lib/url'
import { useNostr } from '@/providers/NostrProvider'
import { TMailboxRelay, TMailboxRelayScope } from '@/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MailboxRelay from './MailboxRelay'
import NewMailboxRelayInput from './NewMailboxRelayInput'
import SaveButton from './SaveButton'

export default function MailboxSetting() {
  const { t } = useTranslation()
  const { pubkey, relayList } = useNostr()
  const [relays, setRelays] = useState<TMailboxRelay[]>([])
  const [hasChange, setHasChange] = useState(false)

  useEffect(() => {
    if (!relayList) return

    const mailboxRelays: TMailboxRelay[] = relayList.read.map((url) => ({ url, scope: 'read' }))
    relayList.write.forEach((url) => {
      const item = mailboxRelays.find((r) => r.url === url)
      if (item) {
        item.scope = 'both'
      } else {
        mailboxRelays.push({ url, scope: 'write' })
      }
    })
    setRelays(mailboxRelays)
  }, [relayList])

  if (!pubkey) {
    return <Button size="lg">Login to set</Button>
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

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground space-y-1">
        <div>{t('read relays description')}</div>
        <div>{t('write relays description')}</div>
        <div>{t('read & write relays notice')}</div>
      </div>
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
