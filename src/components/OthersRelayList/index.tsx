import { useSecondaryPage } from '@/PageManager'
import { Badge } from '@/components/ui/badge'
import { useFetchRelayInfo, useFetchRelayList } from '@/hooks'
import { toRelay } from '@/lib/link'
import { userIdToPubkey } from '@/lib/pubkey'
import { simplifyUrl } from '@/lib/url'
import { TMailboxRelay } from '@/types'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'

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
    <div
      className="flex items-center gap-2 justify-between p-4 rounded-lg border clickable"
      onClick={() => push(toRelay(url))}
    >
      <div className="flex-1 w-0 space-y-2">
        <div className="flex items-center gap-2 w-full">
          <RelayIcon url={url} />
          <div className="truncate font-semibold text-lg">{simplifyUrl(url)}</div>
        </div>
        {!!relayInfo?.description && <div className="line-clamp-2">{relayInfo.description}</div>}
        <div className="flex gap-2">
          {['both', 'read'].includes(scope) && (
            <Badge className="bg-blue-400 hover:bg-blue-400/80">{t('Read')}</Badge>
          )}
          {['both', 'write'].includes(scope) && (
            <Badge className="bg-green-400 hover:bg-green-400/80">{t('Write')}</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <SaveRelayDropdownMenu urls={[url]} />
      </div>
    </div>
  )
}
