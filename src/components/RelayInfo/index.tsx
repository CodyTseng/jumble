import { Badge } from '@/components/ui/badge'
import { useFetchRelayInfo } from '@/hooks'
import { GitBranch, Mail, SquareCode } from 'lucide-react'
import RelayBadges from '../RelayBadges'
import RelayIcon from '../RelayIcon'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function RelayInfo({ url }: { url: string }) {
  const { relayInfo, isFetching } = useFetchRelayInfo(url)
  if (isFetching || !relayInfo) {
    return null
  }

  return (
    <div className="px-4 space-y-4 mb-2">
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <RelayIcon url={url} className="w-8 h-8" />
          {relayInfo.name && <div className="text-2xl font-semibold">{relayInfo.name}</div>}
        </div>
        <RelayBadges relayInfo={relayInfo} />
        {!!relayInfo.tags?.length && (
          <div className="flex gap-2">
            {relayInfo.tags.map((tag) => (
              <Badge variant="secondary">{tag}</Badge>
            ))}
          </div>
        )}
        {relayInfo.description && (
          <div className="text-wrap break-words whitespace-pre-wrap mt-2">
            {relayInfo.description}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-4">
        {relayInfo.pubkey && (
          <div className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-muted-foreground">Operator</div>
            <div className="flex gap-2 items-center">
              <UserAvatar userId={relayInfo.pubkey} size="small" />
              <Username userId={relayInfo.pubkey} className="font-semibold" />
            </div>
          </div>
        )}
        {relayInfo.contact && (
          <div className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-muted-foreground">Contact</div>
            <div className="flex gap-2 items-center font-semibold">
              <Mail />
              {relayInfo.contact}
            </div>
          </div>
        )}
        {relayInfo.software && (
          <div className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-muted-foreground">Software</div>
            <div className="flex gap-2 items-center font-semibold">
              <SquareCode />
              {formatSoftware(relayInfo.software)}
            </div>
          </div>
        )}
        {relayInfo.version && (
          <div className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-muted-foreground">Version</div>
            <div className="flex gap-2 items-center font-semibold">
              <GitBranch />
              {relayInfo.version}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatSoftware(software: string) {
  const parts = software.split('/')
  return parts[parts.length - 1]
}
