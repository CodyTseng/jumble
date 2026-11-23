import { buildATag, createInstalledCommandsDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { compareEvents } from '@/lib/event-core'
import { ExtendedKind } from '@/constants'
import { getInstalledNipCdCommands, parseNipCdDefinition } from '@/lib/nip-cd'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import nipCdService from '@/services/nip-cd.service'
import type { Event } from 'nostr-tools'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useNostr } from './NostrProvider'

type TInstalledCommandsContext = {
  references: ReturnType<typeof getInstalledNipCdCommands>
  coordinates: ReadonlySet<string>
  definitions: ReadonlyMap<string, Event>
  commands: NonNullable<ReturnType<typeof parseNipCdDefinition>>[]
  loading: boolean
  updating: boolean
  addCommand: (event: Event) => Promise<void>
  removeCommand: (coordinate: string) => Promise<void>
}

const InstalledCommandsContext = createContext<TInstalledCommandsContext | undefined>(undefined)

export function useInstalledCommands() {
  const context = useContext(InstalledCommandsContext)
  if (!context) throw new Error('useInstalledCommands requires an InstalledCommandsProvider')
  return context
}

export function InstalledCommandsProvider({ children }: { children: React.ReactNode }) {
  const { pubkey, installedCommandsEvent, publish, updateInstalledCommandsEvent } = useNostr()
  const { t } = useTranslation()
  const event = installedCommandsEvent?.pubkey === pubkey ? installedCommandsEvent : null
  const references = useMemo(() => getInstalledNipCdCommands(event?.tags ?? []), [event])
  const coordinates = useMemo(
    () => new Set(references.map(({ coordinate }) => coordinate)),
    [references]
  )
  const [resolved, setResolved] = useState<{
    pubkey: string | null
    definitions: Map<string, Event>
  }>()
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const activePubkey = useRef(pubkey)
  const pendingUpdate = useRef(false)

  useLayoutEffect(() => {
    activePubkey.current = pubkey
  }, [pubkey])

  useEffect(() => {
    if (!references.length) {
      setResolved(undefined)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    void Promise.all(
      references.map(async (reference) => {
        const event = await nipCdService.fetchInstalledDefinition(reference).catch(() => undefined)
        return [reference.coordinate, event] as const
      })
    ).then((entries) => {
      if (cancelled) return
      const definitions = new Map<string, Event>()
      for (const [coordinate, event] of entries) {
        if (event) definitions.set(coordinate, event)
      }
      setResolved({ pubkey, definitions })
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [pubkey, references])

  const definitions = useMemo(() => {
    if (resolved?.pubkey !== pubkey) return new Map<string, Event>()
    return new Map([...resolved.definitions].filter(([coordinate]) => coordinates.has(coordinate)))
  }, [coordinates, pubkey, resolved])
  const commands = useMemo(
    () => [...definitions.values()].flatMap((event) => parseNipCdDefinition(event) ?? []),
    [definitions]
  )

  const update = async (tag: string[], install: boolean) => {
    if (!pubkey || pendingUpdate.current) return
    pendingUpdate.current = true
    setUpdating(true)
    try {
      const [stored, remote] = await Promise.all([
        indexedDb
          .getReplaceableEvent(pubkey, ExtendedKind.NIP_CD_INSTALLED_COMMANDS)
          .catch(() => undefined),
        client.fetchInstalledCommandsEvent(pubkey)
      ])
      if (activePubkey.current !== pubkey) return
      const latest = [event, stored, remote]
        .filter((candidate): candidate is Event => !!candidate && candidate.pubkey === pubkey)
        .sort((a, b) => compareEvents(b, a))[0]
      const tags = latest?.tags ?? []
      const remaining = tags.filter(([name, coordinate]) => name !== 'a' || coordinate !== tag[1])
      const alreadyInstalled = remaining.length !== tags.length
      if (alreadyInstalled === install) {
        if (latest && latest !== event) await updateInstalledCommandsEvent(latest)
        return
      }
      const draft = createInstalledCommandsDraftEvent(
        install ? [...remaining, tag] : remaining,
        latest
      )
      const published = await publish(draft)
      if (published.pubkey === pubkey) await updateInstalledCommandsEvent(published)
    } catch (error) {
      for (const message of formatError(error)) {
        toast.error(t('Could not update saved commands'), { description: message })
      }
    } finally {
      pendingUpdate.current = false
      setUpdating(false)
    }
  }

  return (
    <InstalledCommandsContext.Provider
      value={{
        references,
        coordinates,
        definitions,
        commands,
        loading,
        updating,
        addCommand: async (event) => {
          if (!parseNipCdDefinition(event)) return
          client.addEventToCache(event)
          await update(buildATag(event), true)
        },
        removeCommand: (coordinate) => update(['a', coordinate], false)
      }}
    >
      {children}
    </InstalledCommandsContext.Provider>
  )
}
