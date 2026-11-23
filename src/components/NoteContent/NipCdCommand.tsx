import { parseNipCdDefinition } from '@/lib/nip-cd'
import { cn } from '@/lib/utils'
import { type Event } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import UnknownNote from './UnknownNote'

export default function NipCdCommand({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const command = useMemo(() => parseNipCdDefinition(event), [event])
  if (!command) return <UnknownNote className={className} event={event} />

  return (
    <div className={cn('min-w-0 space-y-3 text-start', className)}>
      <div className="space-y-1.5">
        <h3 dir="auto" className="text-primary text-lg font-semibold wrap-anywhere">
          <bdi>/{command.command}</bdi>
        </h3>
        {command.title.trim().toLowerCase() !== command.command.toLowerCase() && (
          <p dir="auto" className="text-sm font-medium wrap-anywhere">
            {command.title}
          </p>
        )}
        <p dir="auto" className="text-muted-foreground text-sm wrap-anywhere whitespace-pre-wrap">
          {command.description}
        </p>
      </div>
      {!!command.args.length && (
        <div className="space-y-2 border-t pt-3">
          <h4 className="text-muted-foreground text-xs font-medium">{t('Arguments')}</h4>
          <dl className="space-y-2 text-sm">
            {command.args.map((arg) => (
              <div
                key={arg.name}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5"
              >
                <dt dir="auto" className="wrap-anywhere">
                  {arg.label}
                </dt>
                <dd className="text-muted-foreground text-xs">
                  {arg.required ? t('Required') : t('Optional')}
                </dd>
                {!!arg.choices?.length && (
                  <dd className="text-muted-foreground col-span-2 text-xs wrap-anywhere">
                    {arg.choices.map((choice, index) => (
                      <bdi key={choice}>{index ? ` · ${choice}` : choice}</bdi>
                    ))}
                  </dd>
                )}
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}
