import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { useFetchRelayInfo } from '@/hooks'
import { normalizeHttpUrl } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { Check, Copy, GitBranch, Link, Mail, SquareCode } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import PostEditor from '../PostEditor'
import RelayIcon from '../RelayIcon'
import SaveRelayDropdownMenu from '../SaveRelayDropdownMenu'
import UserAvatar from '../UserAvatar'
import Username from '../Username'
import RelayReviewsPreview from './RelayReviewsPreview'

export default function RelayInfo({ url, className }: { url: string; className?: string }) {
  const { t } = useTranslation()
  const { checkLogin } = useNostr()
  const { relayInfo, isFetching } = useFetchRelayInfo(url)
  const [open, setOpen] = useState(false)

  if (isFetching || !relayInfo) {
    return null
  }

  return (
    <div className={cn('space-y-4 mb-2', className)}>
      <div className="px-4 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 justify-between">
            <div className="flex gap-2 items-center truncate">
              <RelayIcon url={url} className="w-8 h-8" />
              <div className="text-2xl font-semibold truncate select-text">
                {relayInfo.name || relayInfo.shortUrl}
              </div>
            </div>
            <RelayControls url={relayInfo.url} />
          </div>
          {!!relayInfo.tags?.length && (
            <div className="flex gap-2">
              {relayInfo.tags.map((tag) => (
                <Badge variant="secondary">{tag}</Badge>
              ))}
            </div>
          )}
          {relayInfo.description && (
            <div className="text-wrap break-words whitespace-pre-wrap mt-2 select-text">
              {relayInfo.description}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-muted-foreground">{t('Homepage')}</div>
          <a
            href={normalizeHttpUrl(relayInfo.url)}
            target="_blank"
            className="hover:underline text-primary select-text truncate block w-fit max-w-full"
          >
            {normalizeHttpUrl(relayInfo.url)}
          </a>
        </div>

        <ScrollArea className="overflow-x-auto">
          <div className="flex gap-8 pb-2">
            {relayInfo.pubkey && (
              <div className="space-y-2 w-fit">
                <div className="text-sm font-semibold text-muted-foreground">{t('Operator')}</div>
                <div className="flex gap-2 items-center">
                  <UserAvatar userId={relayInfo.pubkey} size="small" />
                  <Username userId={relayInfo.pubkey} className="font-semibold text-nowrap" />
                </div>
              </div>
            )}
            {relayInfo.contact && (
              <div className="space-y-2 w-fit">
                <div className="text-sm font-semibold text-muted-foreground">{t('Contact')}</div>
                <div className="flex gap-2 items-center font-semibold select-text text-nowrap">
                  <Mail />
                  {relayInfo.contact}
                </div>
              </div>
            )}
            {relayInfo.software && (
              <div className="space-y-2 w-fit">
                <div className="text-sm font-semibold text-muted-foreground">{t('Software')}</div>
                <div className="flex gap-2 items-center font-semibold select-text text-nowrap">
                  <SquareCode />
                  {formatSoftware(relayInfo.software)}
                </div>
              </div>
            )}
            {relayInfo.version && (
              <div className="space-y-2 w-fit">
                <div className="text-sm font-semibold text-muted-foreground">{t('Version')}</div>
                <div className="flex gap-2 items-center font-semibold select-text text-nowrap">
                  <GitBranch />
                  {relayInfo.version}
                </div>
              </div>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => checkLogin(() => setOpen(true))}
        >
          {t('Share something on this Relay')}
        </Button>
        <PostEditor open={open} setOpen={setOpen} openFrom={[relayInfo.url]} />
      </div>
      <RelayReviewsPreview relayUrl={url} />
    </div>
  )
}

function formatSoftware(software: string) {
  const parts = software.split('/')
  return parts[parts.length - 1]
}

function RelayControls({ url }: { url: string }) {
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedShareableUrl, setCopiedShareableUrl] = useState(false)

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(url)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2000)
  }

  const handleCopyShareableUrl = () => {
    navigator.clipboard.writeText(`https://jumble.social/?r=${url}`)
    setCopiedShareableUrl(true)
    toast.success('Shareable URL copied to clipboard')
    setTimeout(() => setCopiedShareableUrl(false), 2000)
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="titlebar-icon" onClick={handleCopyShareableUrl}>
        {copiedShareableUrl ? <Check /> : <Link />}
      </Button>
      <Button variant="ghost" size="titlebar-icon" onClick={handleCopyUrl}>
        {copiedUrl ? <Check /> : <Copy />}
      </Button>
      <SaveRelayDropdownMenu urls={[url]} bigButton />
    </div>
  )
}
