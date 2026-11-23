import { Badge } from '@/components/ui/badge'
import { parseNipCdDefinition } from '@/lib/nip-cd'
import { cn } from '@/lib/utils'
import { Terminal } from 'lucide-react'
import { type Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import UnknownNote from './UnknownNote'

export default function NipCdCommand({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const command = useMemo(() => parseNipCdDefinition(event), [event])
  if (!command) return <UnknownNote className={className} event={event} />

  return (
    <div className={cn('bg-card min-w-0 space-y-3 rounded-lg border p-3 text-start', className)}>
      <div className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
        <Terminal aria-hidden="true" className="size-3.5 shrink-0" />
        {t('Slash command')}
      </div>
      <div className="space-y-1">
        <div className="text-primary font-mono font-semibold wrap-anywhere">
          <bdi>/{command.command}</bdi>
        </div>
        <div dir="auto" className="font-semibold wrap-anywhere">
          {command.title}
        </div>
        <div dir="auto" className="text-muted-foreground text-sm wrap-anywhere whitespace-pre-wrap">
          {command.description}
        </div>
      </div>
      {!!command.args.length && (
        <div className="space-y-1">
          <div className="text-muted-foreground text-xs font-medium">{t('Arguments')}</div>
          <dl className="space-y-1.5">
            {command.args.map((arg) => (
              <div key={arg.name} className="text-sm">
                <dt dir="auto" className="font-medium wrap-anywhere">
                  {arg.label}
                </dt>
                <dd className="text-muted-foreground flex flex-wrap items-center gap-x-2 text-xs">
                  <code className="wrap-anywhere">
                    <bdi>
                      {arg.name}: {arg.type}
                    </bdi>
                  </code>
                  <span>{arg.required ? t('Required') : t('Optional')}</span>
                  {!!arg.choices?.length && (
                    <span className="flex flex-wrap gap-x-1">
                      {arg.choices.map((choice) => (
                        <code key={choice} className="wrap-anywhere">
                          <bdi>{choice}</bdi>
                        </code>
                      ))}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {!!command.scopes.length && (
        <div className="space-y-1">
          <div className="text-muted-foreground text-xs font-medium">{t('Scopes')}</div>
          <div className="flex flex-wrap gap-1">
            {Array.from(
              new Set(
                command.scopes.map(({ group, value }) =>
                  group.startsWith('tag:') ? `tag:${value}` : `${group}:${value}`
                )
              )
            ).map((scope) => (
              <Badge
                key={scope}
                variant="secondary"
                className="max-w-full font-mono whitespace-normal"
              >
                <bdi className="wrap-anywhere">{scope}</bdi>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
