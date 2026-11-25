import { StorageKey } from '@/constants'
import { getEventKey } from '@/lib/event-core'
import { useNostr } from '@/providers/NostrProvider'
import { useAtomValue, useSetAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { NostrEvent } from 'nostr-tools'
import { useCallback, useMemo } from 'react'

const MAX_MUTED_NOTES_PER_ACCOUNT = 1000

// Older entries stored a revision ID as the value. Only the key identifies the note.
type MutedNotesByAccount = Record<string, Record<string, string>>
const mutedNotesAtom = atomWithStorage<MutedNotesByAccount>(
  StorageKey.MUTED_NOTE_NOTIFICATIONS,
  {},
  undefined,
  { getOnInit: true }
)
const emptyMutedNoteKeys: ReadonlySet<string> = new Set()

export function useMutedNoteNotifications() {
  const { pubkey } = useNostr()
  const mutedNotes = useAtomValue(mutedNotesAtom)
  const setMutedNotes = useSetAtom(mutedNotesAtom)
  const accountNotes = pubkey ? mutedNotes?.[pubkey] : undefined
  const mutedNoteKeys = useMemo(
    () =>
      accountNotes
        ? new Set(Object.keys(accountNotes).slice(-MAX_MUTED_NOTES_PER_ACCOUNT))
        : emptyMutedNoteKeys,
    [accountNotes]
  )

  const setNoteMuted = useCallback(
    (event: NostrEvent, muted: boolean) => {
      if (!pubkey) return
      const key = getEventKey(event)
      setMutedNotes((previous) => {
        const entries = Object.entries(previous?.[pubkey] ?? {}).slice(-MAX_MUTED_NOTES_PER_ACCOUNT)
        const notes = Object.fromEntries(entries)
        if (muted) {
          if (entries.length === MAX_MUTED_NOTES_PER_ACCOUNT && !Object.hasOwn(notes, key)) {
            delete notes[entries[0][0]]
          }
          notes[key] = key
        } else {
          delete notes[key]
        }
        return { ...previous, [pubkey]: notes }
      })
    },
    [pubkey, setMutedNotes]
  )

  return { mutedNoteKeys, setNoteMuted }
}
