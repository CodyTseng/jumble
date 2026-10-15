import { Button } from '@/components/ui/button'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import { signingAction, type NappletSigningRequest } from '@/lib/napplet/signing'
import { Check, ChevronDown, Copy } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export function SigningAccount({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border p-3">
      <SimpleUserAvatar userId={pubkey} size="small" />
      <div className="min-w-0 space-y-0.5">
        <div className="text-muted-foreground text-xs">{t('Signing account')}</div>
        <SimpleUsername userId={pubkey} className="truncate text-sm font-medium" withoutSkeleton />
        <div dir="ltr" className="text-muted-foreground truncate font-mono text-xs" title={pubkey}>
          {pubkey.slice(0, 12)}…{pubkey.slice(-8)}
        </div>
      </div>
    </div>
  )
}

export default function SigningApproval({ request }: { request: NappletSigningRequest }) {
  const { t, i18n } = useTranslation()
  const [copied, setCopied] = useState(false)
  const { event } = request
  const json = useMemo(
    () => JSON.stringify({ pubkey: request.accountPubkey, ...event }, null, 2),
    [request, event]
  )
  const identifier = event.tags.find((tag) => tag[0] === 'd')?.[1]
  const title = event.kind === 30023 ? event.tags.find((tag) => tag[0] === 'title')?.[1] : undefined
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  return (
    <div className="space-y-4">
      <SigningAccount pubkey={request.accountPubkey} />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="bg-muted rounded px-2 py-1 font-mono">kind {event.kind}</span>
        {identifier !== undefined && (
          <span dir="auto" className="text-muted-foreground break-all">
            d: {JSON.stringify(identifier)}
          </span>
        )}
      </div>
      <p className="text-muted-foreground text-sm">
        {t(
          request.operation === 'upload'
            ? 'This signs an upload authorization. The selected file will be uploaded publicly.'
            : event.kind === 5
              ? 'This publishes a deletion request. Relays may retain earlier copies.'
              : 'This signs and publishes an event with your account. Anyone may read and copy it.'
        )}
      </p>
      <div className="bg-muted/50 space-y-2 rounded-lg border p-3">
        {request.upload ? (
          <>
            <p dir="auto" className="text-sm font-medium break-words">
              {request.upload.filename}
            </p>
            <p className="text-muted-foreground text-xs break-all">
              {new Intl.NumberFormat(i18n.resolvedLanguage, {
                style: 'unit',
                unit: 'byte',
                unitDisplay: 'short'
              }).format(request.upload.bytes)}{' '}
              · {request.upload.mime}
            </p>
          </>
        ) : (
          <>
            {title && (
              <p dir="auto" className="font-medium break-words">
                {title}
              </p>
            )}
            <p dir="auto" className="text-sm break-words whitespace-pre-wrap">
              {event.content.slice(0, 600) || t('No text content')}
            </p>
            {event.content.length > 600 && (
              <p className="text-muted-foreground text-xs">
                {t('Preview truncated. View event details for the full content.')}
              </p>
            )}
          </>
        )}
      </div>
      <div className="space-y-1">
        <div className="text-muted-foreground text-xs">{t('Destinations')}</div>
        {request.destinations.map((url) => (
          <div key={url} dir="ltr" className="text-start text-sm break-all">
            {url}
          </div>
        ))}
      </div>
      <details className="group rounded-lg border">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm [&::-webkit-details-marker]:hidden">
          {t('Event details')}
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-2 border-t p-3">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(json).then(
                  () => setCopied(true),
                  () => toast.error(t('Failed to copy'))
                )
              }}
            >
              {copied ? <Check /> : <Copy />}
              {t(copied ? 'Copied' : 'Copy event')}
            </Button>
          </div>
          <pre dir="ltr" className="text-start font-mono text-xs break-all whitespace-pre-wrap">
            {json}
          </pre>
        </div>
      </details>
    </div>
  )
}

/** Only the decision row rerenders while the host owns expiration and cancellation. */
export function SigningDecisions({
  expiresAt,
  accept,
  deny
}: {
  expiresAt: number
  accept: () => void
  deny: () => void
}) {
  const { t } = useTranslation()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (current >= expiresAt) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [expiresAt])
  const seconds = Math.max(0, Math.ceil((expiresAt - now) / 1000))
  return (
    <div className="flex gap-3">
      <Button variant="outline" className="flex-1" onClick={deny}>
        {t('Reject ({{seconds}}s)', { seconds })}
      </Button>
      <Button className="flex-1" disabled={!seconds} onClick={accept}>
        {t('Approve')}
      </Button>
    </div>
  )
}

export { signingAction }
