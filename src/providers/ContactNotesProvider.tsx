import {
  CONTACT_NAMES_D_TAG,
  CONTACT_NOTES_D_TAG,
  parsePValueMap,
  sanitizeContactComment,
  sanitizeContactName,
  serializePValueMap
} from '@/lib/contact-note'
import { createPrivateContactListDraftEvent } from '@/lib/draft-event'
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
import { useFollowList } from './FollowListProvider'
import { useNostr } from './NostrProvider'
import { useUserPreferences } from './UserPreferencesProvider'

type TContactNotesContext = {
  /** pubkey -> saved display-name snapshot (drives rename detection) */
  names: Map<string, string>
  /** pubkey -> freeform private comment */
  comments: Map<string, string>
  canEdit: boolean
  loading: boolean
  setName: (pubkey: string, name: string) => Promise<void>
  setComment: (pubkey: string, comment: string) => Promise<void>
  /** Apply many name changes in one publish. Empty value deletes the entry. */
  setNamesBatch: (entries: [string, string][]) => Promise<void>
  /** Apply many comment changes in one publish. Empty value deletes the entry. */
  setCommentsBatch: (entries: [string, string][]) => Promise<void>
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
  const { followingSet } = useFollowList()
  const { autoSnapshotContactNames } = useUserPreferences()
  const [names, setNames] = useState<Map<string, string>>(new Map())
  const [comments, setComments] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(false)

  const canEdit = !!accountPubkey && account?.signerType !== 'npub'

  // useNostr() returns fresh function identities every render and NostrProvider
  // re-renders often. Funnel the volatile bits through a ref so the context
  // value only changes on real edits (no feed-wide re-render storm).
  const deps = useRef({ accountPubkey, canEdit, publish, nip44Encrypt, nip44Decrypt, nip04Decrypt })
  deps.current = { accountPubkey, canEdit, publish, nip44Encrypt, nip44Decrypt, nip04Decrypt }
  const savingRef = useRef(false)

  const decrypt = async (
    event: Event | null | undefined,
    sanitize: (v: string | undefined | null) => string
  ): Promise<Map<string, string>> => {
    const { accountPubkey, nip44Decrypt, nip04Decrypt } = deps.current
    if (!event?.content || !accountPubkey) return new Map()
    try {
      const plainText = event.content.includes('?iv=')
        ? await nip04Decrypt(accountPubkey, event.content)
        : await nip44Decrypt(accountPubkey, event.content)
      const tags = JSON.parse(plainText)
      if (!Array.isArray(tags)) return new Map()
      return parsePValueMap(tags as string[][], sanitize)
    } catch {
      return new Map()
    }
  }

  useEffect(() => {
    let cancelled = false
    if (!accountPubkey || !canEdit) {
      setNames(new Map())
      setComments(new Map())
      return
    }
    setLoading(true)
    Promise.all([
      client
        .fetchPrivateContactListEvent(accountPubkey, CONTACT_NAMES_D_TAG)
        .then((e) => decrypt(e, sanitizeContactName)),
      client
        .fetchPrivateContactListEvent(accountPubkey, CONTACT_NOTES_D_TAG)
        .then((e) => decrypt(e, sanitizeContactComment))
    ])
      .then(([n, c]) => {
        if (cancelled) return
        setNames(n)
        setComments(c)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [accountPubkey, canEdit])

  // Re-fetch the latest list for `dTag`, apply mutate, encrypt, publish. Builds
  // on freshest relay state so concurrent edits aren't clobbered. Never prunes
  // entries the caller didn't touch.
  const commitList = useCallback(
    async (
      dTag: string,
      sanitize: (v: string | undefined | null) => string,
      mutate: (map: Map<string, string>) => void,
      apply: (map: Map<string, string>) => void
    ) => {
      const { accountPubkey, canEdit, nip44Encrypt, publish } = deps.current
      if (!accountPubkey || !canEdit || savingRef.current) return
      savingRef.current = true
      try {
        const existing = await client.fetchPrivateContactListEvent(accountPubkey, dTag, true)
        const map = await decrypt(existing, sanitize)
        mutate(map)
        const tags = serializePValueMap(map)
        const cipherText =
          tags.length > 0 ? await nip44Encrypt(accountPubkey, JSON.stringify(tags)) : ''
        const event = await publish(createPrivateContactListDraftEvent(dTag, cipherText))
        if (event.pubkey === accountPubkey) apply(map)
      } catch (error) {
        formatError(error).forEach((err) =>
          toast.error(t('Failed to save contact note') + ': ' + err, { duration: 10_000 })
        )
        throw error
      } finally {
        savingRef.current = false
      }
    },
    []
  )

  const setName = useCallback(
    async (pubkey: string, name: string) => {
      const clean = sanitizeContactName(name)
      await commitList(
        CONTACT_NAMES_D_TAG,
        sanitizeContactName,
        (map) => (clean ? map.set(pubkey, clean) : map.delete(pubkey)),
        setNames
      )
    },
    [commitList]
  )

  const setComment = useCallback(
    async (pubkey: string, comment: string) => {
      const clean = sanitizeContactComment(comment)
      await commitList(
        CONTACT_NOTES_D_TAG,
        sanitizeContactComment,
        (map) => (clean ? map.set(pubkey, clean) : map.delete(pubkey)),
        setComments
      )
    },
    [commitList]
  )

  const setNamesBatch = useCallback(
    async (entries: [string, string][]) => {
      if (!entries.length) return
      await commitList(
        CONTACT_NAMES_D_TAG,
        sanitizeContactName,
        (map) => {
          for (const [pk, v] of entries) {
            const c = sanitizeContactName(v)
            if (c) map.set(pk, c)
            else map.delete(pk)
          }
        },
        setNames
      )
    },
    [commitList]
  )

  const setCommentsBatch = useCallback(
    async (entries: [string, string][]) => {
      if (!entries.length) return
      await commitList(
        CONTACT_NOTES_D_TAG,
        sanitizeContactComment,
        (map) => {
          for (const [pk, v] of entries) {
            const c = sanitizeContactComment(v)
            if (c) map.set(pk, c)
            else map.delete(pk)
          }
        },
        setComments
      )
    },
    [commitList]
  )

  const bulkSnapshotNames = useCallback(
    async (pubkeys: string[], resolve: (pubkey: string) => Promise<string | undefined>) => {
      const { accountPubkey, canEdit, nip44Encrypt, publish } = deps.current
      if (!accountPubkey || !canEdit) return 0

      // 1. Resolve names first (slow: profile fetches). We hold no event yet, so
      //    this long phase can't clobber a concurrent manual edit.
      const resolved = new Map<string, string>()
      const CHUNK = 50
      for (let i = 0; i < pubkeys.length; i += CHUNK) {
        const out = await Promise.all(
          pubkeys.slice(i, i + CHUNK).map(async (pk) => {
            try {
              return [pk, sanitizeContactName(await resolve(pk))] as const
            } catch {
              return [pk, ''] as const
            }
          })
        )
        for (const [pk, name] of out) {
          if (name) resolved.set(pk, name)
        }
      }
      if (resolved.size === 0) return 0

      // 2. Fetch the freshest list right before publishing, and fill ONLY gaps —
      //    never overwrite an existing recorded name (preserves manual edits and
      //    earlier snapshots; a re-follow can't clobber).
      const existing = await client.fetchPrivateContactListEvent(accountPubkey, CONTACT_NAMES_D_TAG, true)
      const map = await decrypt(existing, sanitizeContactName)
      let added = 0
      for (const [pk, name] of resolved) {
        if (map.get(pk)) continue
        map.set(pk, name)
        added++
      }
      if (!added) return 0

      const tags = serializePValueMap(map)
      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(tags))
      const event = await publish(createPrivateContactListDraftEvent(CONTACT_NAMES_D_TAG, cipherText))
      if (event.pubkey === accountPubkey) setNames(map)
      return added
    },
    []
  )

  // Impersonation protection: keep a name snapshot for everyone the user
  // follows, captured *now*, so a later rename (e.g. a hijacked key renamed to
  // impersonate someone else) shows up as a mismatch. Runs in the background,
  // fills only gaps, never overwrites. Converges: once a follow has a name (or
  // has no kind-0 to snapshot), it stops re-attempting until the follow list
  // or names map changes.
  const autoRunningRef = useRef(false)
  useEffect(() => {
    if (!canEdit || loading || !autoSnapshotContactNames || autoRunningRef.current) return
    const missing = Array.from(followingSet).filter((pk) => !names.get(pk))
    if (missing.length === 0) return
    autoRunningRef.current = true
    bulkSnapshotNames(missing, async (pubkey) => {
      const profile = await client.fetchProfile(pubkey)
      return profile?.original_username
    }).finally(() => {
      autoRunningRef.current = false
    })
  }, [followingSet, names, canEdit, loading, autoSnapshotContactNames, bulkSnapshotNames])

  const value = useMemo(
    () => ({
      names,
      comments,
      canEdit,
      loading,
      setName,
      setComment,
      setNamesBatch,
      setCommentsBatch,
      bulkSnapshotNames
    }),
    [
      names,
      comments,
      canEdit,
      loading,
      setName,
      setComment,
      setNamesBatch,
      setCommentsBatch,
      bulkSnapshotNames
    ]
  )

  return <ContactNotesContext.Provider value={value}>{children}</ContactNotesContext.Provider>
}
