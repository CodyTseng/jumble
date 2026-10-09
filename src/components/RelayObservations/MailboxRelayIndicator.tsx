import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { toRelayActivity } from '@/lib/link'
import { observationDate } from '@/lib/relay-observation'
import { cn } from '@/lib/utils'
import { TMailboxRelayScope } from '@/types'
import { useTranslation } from 'react-i18next'
import { useRelayObservations } from '.'
import { getMailboxRelayIssues, getMailboxRelaySeverity } from './mailbox-relay-issues'
import { connectionQualityBackgrounds } from './connection-quality'

export default function MailboxRelayIndicator({
  url,
  scope
}: {
  url: string
  scope: TMailboxRelayScope
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const observations = useRelayObservations()
  const days = observations.get(url)?.days
  const latest = days?.[days.length - 1]
  const issues = getMailboxRelayIssues(latest, scope)
  const severity = getMailboxRelaySeverity(latest, scope)
  const label = `${t('Recorded issues')}: ${issues ?? '—'}`
  const description =
    issues === undefined
      ? t('No relay activity recorded yet')
      : `${t('Latest active day')}: ${latest!.date}`

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="relative -ms-2 size-4 shrink-0 rounded-full p-0 before:absolute before:-inset-1 before:rounded-full before:content-['']"
      title={`${label}\n${description}\n${t('View relay details')}`}
      aria-label={`${t('Connection quality')}. ${label}. ${description}. ${t('View relay details')}`}
      onClick={() => push(toRelayActivity(url))}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 shrink-0 rounded-full',
          severity && (severity !== 'healthy' || latest?.date === observationDate(Date.now()))
            ? connectionQualityBackgrounds[severity]
            : 'bg-muted-foreground'
        )}
      />
    </Button>
  )
}
