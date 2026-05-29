import {
  parseContactNotesFromPrivateTags,
  sanitizeContactComment,
  sanitizeContactName,
  serializeContactNotesToPrivateTags,
  TContactNote
} from '@/lib/contact-note'
import { createContactNotesDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import client from '@/services/client.service'
import { Event } from 'nostr-tools'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useNostr } from './NostrProvider'

type TContactNotesContext = {
  notes: Map<string, TContactNote>
  canEdit: boolean
  loading: boolean
  setNote: (pubkey: string, patch: { name?: string; comment?: string }) => Promise<void>
  removeNote: (pubkey: string) => Promise<void>
  bulkSnapshotNames: (
    pubkeys: string[],
    resolve: (pubkey: string) => Promise<string | undefined>
  ) => Promise<number>
}

const ContactNotesContext = createContext<TContactNotesContext | undefined>(undefined)

export const useContactNotes = () => {
  const context = useContext(ContactNotesContext)
  if (!context) {
    throw new Error('useContactNotes must be used within a ContactNotesProvider')
  }
  return context
}

export function ContactNotesProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, account, publish, nip44Encrypt, nip44Decrypt, nip04Decrypt } =
    useNostr()
  const [notes, setNotes] = useState<Map<string, TContactNote>>(new Map())
  const [loading, setLoading] = useState(false)

  const canEdit = !!accountPubkey && account?.signerType !== 'npub'

  // useNostr() hands back fresh function identities on every render, and
  // NostrProvider re-renders frequently. Funnel the volatile bits through a ref
  // so the context value (and thus every Username consumer) doesn't churn.
  const deps = useRef({ accountPubkey, canEdit, publish, nip44Encrypt, nip44Decrypt, nip04Decrypt })
  deps.current = { accountPubkey, canEdit, publish, nip44Encrypt, nip44Decrypt, nip04Decrypt }
  const savingRef = useRef(false)

  const decryptNotes = async (
    event: Event | null | undefined
  ): Promise<Map<string, TContactNote>> => {
    const { accountPubkey, nip44Decrypt, nip04Decrypt } = deps.current
    if (!event?.content || !accountPubkey) return new Map()
    try {
      const wasNip04 = event.content.includes('?iv=')
      const plainText = wasNip04
        ? await nip04Decrypt(accountPubkey, event.content)
        : await nip44Decrypt(accountPubkey, event.content)
      const tags = JSON.parse(plainText)
      if (!Array.isArray(tags)) return new Map()
      return parseContactNotesFromPrivateTags(tags as string[][])
    } catch {
      // npub-only signer or corrupt content — treat as empty.
      return new Map()
    }
  }

  useEffect(() => {
    let cancelled = false
    if (!accountPubkey || !canEdit) {
      setNotes(new Map())
      return
    }
    setLoading(true)
    client
      .fetchContactNotesEvent(accountPubkey)
      .then((event) => decryptNotes(event))
      .then((map) => {
        if (!cancelled) setNotes(map)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountPubkey, canEdit])

  // Re-fetch latest, apply mutate, encrypt, publish. Builds on freshest relay
  // state so concurrent edits elsewhere aren't clobbered.
  const commit = useCallback(async (mutate: (map: Map<string, TContactNote>) => void) => {
    const { accountPubkey, canEdit, nip44Encrypt, publish } = deps.current
    if (!accountPubkey || !canEdit || savingRef.current) return
    savingRef.current = true
    try {
      const existing = await client.fetchContactNotesEvent(accountPubkey, true)
      const map = await decryptNotes(existing)
      mutate(map)
      const privateTags = serializeContactNotesToPrivateTags(map)
      const cipherText =
        privateTags.length > 0 ? await nip44Encrypt(accountPubkey, JSON.stringify(privateTags)) : ''
      const event = await publish(createContactNotesDraftEvent([], cipherText))
      if (event.pubkey === accountPubkey) setNotes(map)
    } catch (error) {
      formatError(error).forEach((err) =>
        toast.error(t('Failed to save contact note') + ': ' + err, { duration: 10_000 })
      )
      throw error
    } finally {
      savingRef.current = false
    }
  }, [])

  const setNote = useCallback(
    async (pubkey: string, patch: { name?: string; comment?: string }) => {
      await commit((map) => {
        const prev = map.get(pubkey)
        const name = patch.name !== undefined ? sanitizeContactName(patch.name) : (prev?.name ?? '')
        const comment =
          patch.comment !== undefined
            ? sanitizeContactComment(patch.comment)
            : (prev?.comment ?? '')
        if (!name && !comment) map.delete(pubkey)
        else map.set(pubkey, { pubkey, name, comment })
      })
    },
    [commit]
  )

  const removeNote = useCallback(
    async (pubkey: string) => {
      await commit((map) => {
        map.delete(pubkey)
      })
    },
    [commit]
  )

  const bulkSnapshotNames = useCallback(
    async (pubkeys: string[], resolve: (pubkey: string) => Promise<string | undefined>) => {
      const { accountPubkey, canEdit, nip44Encrypt, publish } = deps.current
      if (!accountPubkey || !canEdit) return 0
      const existing = await client.fetchContactNotesEvent(accountPubkey, true)
      const map = await decryptNotes(existing)
      const missing = pubkeys.filter((pk) => !map.get(pk)?.name)
      if (!missing.length) return 0

      let added = 0
      const CHUNK = 50
      for (let i = 0; i < missing.length; i += CHUNK) {
        const out = await Promise.all(
          missing.slice(i, i + CHUNK).map(async (pk) => {
            try {
              return [pk, sanitizeContactName(await resolve(pk))] as const
            } catch {
              return [pk, ''] as const
            }
          })
        )
        for (const [pk, name] of out) {
          if (!name) continue
          const prev = map.get(pk)
          map.set(pk, { pubkey: pk, name, comment: prev?.comment ?? '' })
          added++
        }
      }
      if (!added) return 0

      const privateTags = serializeContactNotesToPrivateTags(map)
      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(privateTags))
      const event = await publish(createContactNotesDraftEvent([], cipherText))
      if (event.pubkey === accountPubkey) setNotes(map)
      return added
    },
    []
  )

  const value = useMemo(
    () => ({ notes, canEdit, loading, setNote, removeNote, bulkSnapshotNames }),
    [notes, canEdit, loading, setNote, removeNote, bulkSnapshotNames]
  )

  return <ContactNotesContext.Provider value={value}>{children}</ContactNotesContext.Provider>
}
