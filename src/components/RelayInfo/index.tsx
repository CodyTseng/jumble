import { Badge } from '@/components/ui/badge'
import { useFetchRelayInfo } from '@/hooks'
import { normalizeHttpUrl } from '@/lib/url'
import { GitBranch, Mail, SquareCode } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import RelayBadges from '../RelayBadges'
import RelayIcon from '../RelayIcon'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function RelayInfo({ url }: { url: string }) {
  const { t } = useTranslation()
  const { relayInfo, isFetching } = useFetchRelayInfo(url)
  if (isFetching || !relayInfo) {
    return null
  }

  return (
    <div className="px-4 space-y-4 mb-2">
      <div className="space-y-2">
        <div className="flex gap-2 items-center">
          <RelayIcon url={url} className="w-8 h-8" />
          <div className="text-2xl font-semibold">{relayInfo.name || relayInfo.shortUrl}</div>
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
      {!!relayInfo.supported_nips?.length && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-muted-foreground">{t('Supported NIPs')}</div>
          <div className="flex flex-wrap gap-2">
            {relayInfo.supported_nips
              .sort((a, b) => a - b)
              .map((nip) => (
                <Badge
                  key={nip}
                  variant="secondary"
                  className="clickable"
                  onClick={() =>
                    window.open(
                      `https://github.com/nostr-protocol/nips/blob/master/${formatNip(nip)}.md`
                    )
                  }
                >
                  {formatNip(nip)}
                </Badge>
              ))}
          </div>
        </div>
      )}
      {relayInfo.payments_url && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-muted-foreground">{t('Payment page')}:</div>
          <a
            href={normalizeHttpUrl(relayInfo.payments_url)}
            target="_blank"
            className="hover:underline text-primary"
          >
            {relayInfo.payments_url}
          </a>
        </div>
      )}
      <div className="flex flex-wrap gap-4">
        {relayInfo.pubkey && (
          <div className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-muted-foreground">{t('Operator')}</div>
            <div className="flex gap-2 items-center">
              <UserAvatar userId={relayInfo.pubkey} size="small" />
              <Username userId={relayInfo.pubkey} className="font-semibold" />
            </div>
          </div>
        )}
        {relayInfo.contact && (
          <div className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-muted-foreground">{t('Contact')}</div>
            <div className="flex gap-2 items-center font-semibold">
              <Mail />
              {relayInfo.contact}
            </div>
          </div>
        )}
        {relayInfo.software && (
          <div className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-muted-foreground">{t('Software')}</div>
            <div className="flex gap-2 items-center font-semibold">
              <SquareCode />
              {formatSoftware(relayInfo.software)}
            </div>
          </div>
        )}
        {relayInfo.version && (
          <div className="space-y-2 flex-1">
            <div className="text-sm font-semibold text-muted-foreground">{t('Version')}</div>
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

function formatNip(nip: number) {
  if (nip < 10) {
    return `0${nip}`
  }
  return `${nip}`
}
