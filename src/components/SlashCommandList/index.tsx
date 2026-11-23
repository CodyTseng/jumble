import CommandSaveButton from '@/components/CommandSaveButton'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import { toNote } from '@/lib/link'
import { isValidPubkey } from '@/lib/pubkey'
import {
  getNipCdCommandAddress,
  getNipCdCommandCoordinate,
  parseNipCdDefinition
} from '@/lib/nip-cd'
import { useSecondaryPage } from '@/PageManager'
import { useInstalledCommands } from '@/providers/InstalledCommandsProvider'
import client from '@/services/client.service'
import nipCdService from '@/services/nip-cd.service'
import type { Event } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function SlashCommandList({ executor }: { executor?: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const installed = useInstalledCommands()
  const isProfile = executor !== undefined
  const [catalog, setCatalog] = useState<{ executor: string; events: Event[]; loading: boolean }>()

  useEffect(() => {
    if (!executor || !isValidPubkey(executor)) return
    let cancelled = false
    const load = async () => {
      const cached = await nipCdService.getCachedDefinitionEvents(executor)
      if (cancelled) return
      setCatalog({ executor, events: cached, loading: true })
      const changed = await nipCdService.refresh(executor)
      const events = changed ? await nipCdService.getCachedDefinitionEvents(executor) : cached
      if (!cancelled) setCatalog({ executor, events, loading: false })
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [executor])

  const profileCatalog = catalog?.executor === executor ? catalog : undefined
  const rows = isProfile
    ? (profileCatalog?.events ?? []).flatMap((event) => {
        const command = parseNipCdDefinition(event)
        return command
          ? [
              {
                coordinate: getNipCdCommandCoordinate(command),
                executor: command.executor,
                identifier: command.id,
                command,
                event,
                reference: undefined
              }
            ]
          : []
      })
    : installed.references.map((reference) => {
        const event = installed.definitions.get(reference.coordinate)
        const command = event ? parseNipCdDefinition(event) : undefined
        return { ...reference, command, event, reference }
      })
  const loading =
    isProfile && isValidPubkey(executor)
      ? (profileCatalog?.loading ?? true)
      : !isProfile && installed.loading

  return (
    <div>
      {rows.length ? (
        <ul>
          {rows.map((row) => (
            <li
              className="hover:bg-accent/30 flex items-center gap-2 border-b px-4 transition-colors"
              key={row.coordinate}
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-3 text-start"
                onClick={() => {
                  if (row.event) {
                    client.addEventToCache(row.event)
                    push(toNote(row.event))
                  } else if (row.reference) {
                    push(toNote(getNipCdCommandAddress(row.reference)))
                  }
                }}
              >
                <SimpleUserAvatar userId={row.executor} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <bdi className="truncate font-semibold">
                      {row.command
                        ? `/${row.command.command}`
                        : row.identifier || t('Slash command')}
                    </bdi>
                    {!isProfile && (
                      <SimpleUsername
                        userId={row.executor}
                        className="text-muted-foreground truncate text-xs"
                      />
                    )}
                  </div>
                  {row.command && (
                    <p dir="auto" className="text-muted-foreground line-clamp-2 text-sm">
                      {row.command.description}
                    </p>
                  )}
                </div>
              </button>
              <CommandSaveButton coordinate={row.coordinate} event={row.event} />
            </li>
          ))}
        </ul>
      ) : (
        <p role="status" className="text-muted-foreground mt-2 text-center text-sm">
          {loading
            ? t('Loading...')
            : t(isProfile ? 'No slash commands found' : 'No saved commands yet')}
        </p>
      )}
    </div>
  )
}
