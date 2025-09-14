import { useSecondaryPage } from '@/PageManager'
import { Badge } from '@/components/ui/badge'
import { useFetchRelayInfo, useFetchRelayList } from '@/hooks'
import { toRelay } from '@/lib/link'
import { userIdToPubkey } from '@/lib/pubkey'
import { TMailboxRelay } from '@/types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import RelaySimpleInfo from '../RelaySimpleInfo'

export default function OthersRelayList({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const pubkey = useMemo(() => userIdToPubkey(userId), [userId])
  const { relayList, isFetching } = useFetchRelayList(pubkey)

  if (isFetching) {
    return <div className="text-center text-sm text-muted-foreground">{t('loading...')}</div>
  }

  return (
    <div className="space-y-4">
      {relayList.originalRelays.map((relay, index) => (
        <RelayItem key={`read-${relay.url}-${index}`} relay={relay} />
      ))}
    </div>
  )
}

function RelayItem({ relay }: { relay: TMailboxRelay }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { relayInfo } = useFetchRelayInfo(relay.url)
  const { url, scope } = relay

  return (
    <div className="p-4 rounded-lg border clickable space-y-1" onClick={() => push(toRelay(url))}>
      <RelaySimpleInfo relayInfo={relayInfo} />
      <div className="flex gap-2">
        {['both', 'read'].includes(scope) && (
          <Badge className="bg-blue-400 hover:bg-blue-400/80">{t('Read')}</Badge>
        )}
        {['both', 'write'].includes(scope) && (
          <Badge className="bg-green-400 hover:bg-green-400/80">{t('Write')}</Badge>
        )}
      </div>
    </div>
  )
}
