import { useFetchRelayList } from '@/hooks'
import { toOthersRelaySettings, toRelaySettings } from '@/lib/link'
import { SecondaryPageLink } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { Loader } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function Relays({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey } = useNostr()
  const { relayList, isFetching } = useFetchRelayList(pubkey)

  return (
    <SecondaryPageLink
      to={accountPubkey === pubkey ? toRelaySettings('mailbox') : toOthersRelaySettings(pubkey)}
      className="flex gap-1 hover:underline w-fit items-center"
    >
      {isFetching ? <Loader className="animate-spin size-4" /> : relayList.originalRelays.length}
      <div className="text-muted-foreground">{t('Relays')}</div>
    </SecondaryPageLink>
  )
}
