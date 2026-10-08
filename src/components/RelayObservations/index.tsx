import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import {
  medianTiming,
  observationDate,
  RelayObservationDay,
  sumCounts,
  TimingHistogram
} from '@/lib/relay-observation'
import relayObservations from '@/services/relay-observation.service'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

export function useRelayObservations() {
  useSyncExternalStore(relayObservations.subscribe, relayObservations.getSnapshot)
  return relayObservations
}

function mergeCounts(counts: Record<string, number>[]) {
  const result = new Map<string, number>()
  for (const item of counts)
    for (const [reason, count] of Object.entries(item)) {
      result.set(reason, (result.get(reason) ?? 0) + count)
    }
  return Array.from(result).sort((a, b) => b[1] - a[1])
}

function Timing({ label, timing }: { label: string; timing: TimingHistogram }) {
  const { t } = useTranslation()
  const median = medianTiming(timing)
  return (
    <div className="min-w-0 space-y-1">
      <div className="text-muted-foreground text-xs">{t(label)}</div>
      <div className="font-medium tabular-nums">
        {median === undefined ? '—' : `≈ ${Math.round(median)} ms`}
      </div>
      <div className="text-muted-foreground text-xs">
        {t('Observation samples', { count: timing.count, defaultValue: '{{count}} samples' })}
      </div>
    </div>
  )
}

function Day({ day }: { day: RelayObservationDay }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const failures = sumCounts(day.connectionFailures)
  const ratio = day.connections ? failures / day.connections : undefined
  const color =
    ratio === undefined
      ? 'bg-muted'
      : ratio === 0
        ? 'bg-emerald-500'
        : ratio <= 0.1
          ? 'bg-yellow-400'
          : ratio <= 0.5
            ? 'bg-orange-500'
            : 'bg-red-500'
  const label = `${day.date}: ${t('Connection attempts')} ${day.connections}, ${t('Connection failures')} ${failures}`
  return (
    <HoverCard open={open} onOpenChange={setOpen} openDelay={100}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="focus-visible:ring-ring min-w-0 flex-1 space-y-1 rounded-sm focus-visible:ring-2 focus-visible:outline-hidden"
          aria-label={label}
          aria-expanded={open}
          onClick={() => setOpen(true)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') setOpen(false)
          }}
        >
          <span className={`block h-7 rounded-sm ${color}`} />
          <span className="text-muted-foreground block text-[10px]" dir="ltr">
            {day.date.slice(5)}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-80 max-w-[calc(100vw-2rem)] space-y-3 text-sm" align="start">
        <div className="font-semibold">
          {day.date}
          {day.date === observationDate(Date.now()) ? ` · ${t('Today (in progress)')}` : ''}
        </div>
        <dl className="grid grid-cols-2 gap-1">
          <dt>{t('Connection attempts')}</dt>
          <dd className="text-end tabular-nums">{day.connections}</dd>
          <dt>{t('Connection failures')}</dt>
          <dd className="text-end tabular-nums">{failures}</dd>
          <dt>{t('Failure rate')}</dt>
          <dd className="text-end tabular-nums">
            {ratio === undefined ? '—' : `${(ratio * 100).toFixed(1)}%`}
          </dd>
        </dl>
        <div className="grid grid-cols-3 gap-2 border-t pt-3">
          <Timing label="Connection time" timing={day.connectionTime} />
          <Timing label="Write time" timing={day.writeTime} />
          <Timing label="First event time" timing={day.readTime} />
        </div>
        {!!failures && <ReasonCounts reasons={mergeCounts([day.connectionFailures])} />}
      </HoverCardContent>
    </HoverCard>
  )
}

function ReasonCounts({ reasons }: { reasons: [string, number][] }) {
  const { t } = useTranslation()
  return (
    <ul className="max-h-60 space-y-2 overflow-y-auto text-sm">
      {reasons.map(([reason, count]) => (
        <li key={reason} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <span className="min-w-0 wrap-break-word select-text" dir="auto">
            {reason === 'first-event'
              ? t('No query response received')
              : reason === 'completion'
                ? t('Query not completed after receiving data')
                : t(reason, { defaultValue: reason })}
          </span>
          <span className="min-w-8 text-end font-medium tabular-nums">{count}</span>
        </li>
      ))}
    </ul>
  )
}

function Issues({ label, reasons }: { label: string; reasons: [string, number][] }) {
  const { t } = useTranslation()
  const count = reasons.reduce((sum, [, value]) => sum + value, 0)
  if (!count) {
    return (
      <div className="text-muted-foreground flex items-center justify-between gap-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <span className="size-4" aria-hidden="true" />
          {t(label)}
        </span>
        <span className="min-w-8 text-end tabular-nums">0</span>
      </div>
    )
  }
  return (
    <details className="group/issue py-3">
      <summary className="focus-visible:ring-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-sm text-sm focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <ChevronRight className="size-4 shrink-0 group-open/issue:hidden rtl:-scale-x-100" />
          <ChevronDown className="hidden size-4 shrink-0 group-open/issue:block" />
          {t(label)}
        </span>
        <span className="min-w-8 text-end font-semibold tabular-nums">{count}</span>
      </summary>
      <div className="ps-6 pt-3">
        <ReasonCounts reasons={reasons} />
      </div>
    </details>
  )
}

function DayStatistics({
  day,
  showDescription = true
}: {
  day: RelayObservationDay
  showDescription?: boolean
}) {
  const { t } = useTranslation()
  const connections = day.connections
  const failures = sumCounts(day.connectionFailures)
  const writeTimeouts = day.writeTimeouts
  const counts = [
    ['Connection attempts', connections],
    ['Connection failures', failures],
    ['Failure rate', connections ? `${((failures / connections) * 100).toFixed(1)}%` : '—']
  ] as const
  return (
    <div className="space-y-3">
      <time dateTime={day.date} className="text-foreground block text-sm font-semibold">
        {day.date}
      </time>
      <dl className="grid grid-cols-3 gap-3">
        {counts.map(([label, value]) => (
          <div key={label} className="min-w-0 space-y-1">
            <dt className="text-muted-foreground text-xs">{t(label)}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="bg-muted/50 grid grid-cols-3 gap-3 rounded-lg p-3">
        <Timing label="Connection time" timing={day.connectionTime} />
        <Timing label="Write time" timing={day.writeTime} />
        <Timing label="First event time" timing={day.readTime} />
      </div>
      {showDescription && (
        <p className="text-muted-foreground text-xs">
          {t(
            'Approximate median of successful operations. Authentication retries are included. Empty queries have no first event time.'
          )}
        </p>
      )}
      <div className="divide-y">
        <Issues label="Read rejections" reasons={mergeCounts([day.readRejections])} />
        <Issues label="Read timeouts" reasons={mergeCounts([day.readTimeouts])} />
        <Issues label="Write rejections" reasons={mergeCounts([day.writeRejections])} />
        <Issues
          label="Write timeouts"
          reasons={writeTimeouts ? [[t('No write confirmation received'), writeTimeouts]] : []}
        />
      </div>
    </div>
  )
}

export default function RelayObservations({
  url,
  compact = false
}: {
  url: string
  compact?: boolean
}) {
  const { t } = useTranslation()
  const observations = useRelayObservations()
  const days = observations.get(url)?.days ?? []
  const latest = days[days.length - 1]
  return (
    <section className="space-y-4" aria-label={t('Connection quality')}>
      {!latest ? (
        <p className="text-muted-foreground text-sm">{t('No relay activity recorded yet')}</p>
      ) : (
        <>
          <div className="space-y-2 border-b pb-3">
            <div className="text-muted-foreground text-xs">{t('Last 7 active days')}</div>
            <div className="flex gap-1.5">
              {days.map((day) => (
                <Day key={day.date} day={day} />
              ))}
            </div>
            {!compact && (
              <p className="text-muted-foreground text-xs">
                {t('Connection colors describe failure rate; gray means no connection attempts.')}
              </p>
            )}
          </div>
          <div className="divide-y">
            {[...days].reverse().map((day, index) => (
              <section key={day.date} aria-label={day.date} className="py-4 first:pt-0 last:pb-0">
                <DayStatistics day={day} showDescription={!compact && index === 0} />
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
