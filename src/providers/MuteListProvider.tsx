import { createMuteListDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { addLegacyMutedWords, getMutedWordsFromTags, updateMutedWordTag } from '@/lib/mute-words'
import { getPubkeysFromPTags } from '@/lib/tag'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import { Event, kinds } from 'nostr-tools'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useNostr } from './NostrProvider'

type TMuteListContext = {
  mutePubkeySet: Set<string>
  changing: boolean
  getMutePubkeys: () => string[]
  getMuteType: (pubkey: string) => 'public' | 'private' | null
  mutePubkeyPublicly: (pubkey: string) => Promise<void>
  mutePubkeyPrivately: (pubkey: string) => Promise<void>
  unmutePubkey: (pubkey: string) => Promise<void>
  switchToPublicMute: (pubkey: string) => Promise<void>
  switchToPrivateMute: (pubkey: string) => Promise<void>
  mutedWords: string[]
  publicMutedWords: string[]
  privateMutedWords: string[]
  mutedWordsMigrationFailed: boolean
  retryMutedWordsMigration: () => void
  addMuteWord: (word: string, visibility: 'public' | 'private') => Promise<boolean>
  removeMuteWord: (word: string, visibility: 'public' | 'private') => Promise<boolean>
  refreshMuteWords: () => Promise<void>
}

const MuteListContext = createContext<TMuteListContext | undefined>(undefined)

export const useMuteList = () => {
  const context = useContext(MuteListContext)
  if (!context) {
    throw new Error('useMuteList must be used within a MuteListProvider')
  }
  return context
}

export function MuteListProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const {
    pubkey: accountPubkey,
    muteListEvent,
    publish,
    updateMuteListEvent,
    nip04Decrypt,
    nip44Encrypt,
    nip44Decrypt
  } = useNostr()
  const [tags, setTags] = useState<string[][]>([])
  const [privateTags, setPrivateTags] = useState<string[][]>([])
  const [legacyPendingWords, setLegacyPendingWords] = useState<string[]>(storage.getMutedWords())
  const migrationInProgress = useRef(false)
  const [migrationTick, setMigrationTick] = useState(0)
  const [mutedWordsMigrationFailed, setMutedWordsMigrationFailed] = useState(false)
  const currentAccountPubkey = useRef(accountPubkey)
  currentAccountPubkey.current = accountPubkey
  const publicMutePubkeySet = useMemo(() => new Set(getPubkeysFromPTags(tags)), [tags])
  const privateMutePubkeySet = useMemo(
    () => new Set(getPubkeysFromPTags(privateTags)),
    [privateTags]
  )
  const mutePubkeySet = useMemo(() => {
    return new Set([...Array.from(privateMutePubkeySet), ...Array.from(publicMutePubkeySet)])
  }, [publicMutePubkeySet, privateMutePubkeySet])
  const publicMuteWords = useMemo(() => new Set(getMutedWordsFromTags(tags)), [tags])
  const privateMuteWords = useMemo(() => new Set(getMutedWordsFromTags(privateTags)), [privateTags])
  const publicMutedWords = useMemo(() => Array.from(publicMuteWords), [publicMuteWords])
  const privateMutedWords = useMemo(
    () =>
      Array.from(
        new Set([
          ...privateMuteWords,
          ...legacyPendingWords.map((word) => word.trim().toLowerCase()).filter(Boolean)
        ])
      ),
    [privateMuteWords, legacyPendingWords]
  )
  const mutedWords = useMemo(
    () => Array.from(new Set([...publicMutedWords, ...privateMutedWords])),
    [publicMutedWords, privateMutedWords]
  )
  const [changing, setChanging] = useState(false)

  const getPrivateTags = useCallback(
    async (muteListEvent: Event): Promise<{ privateTags: string[][]; wasNip04: boolean }> => {
      if (!muteListEvent.content) return { privateTags: [], wasNip04: false }

      try {
        const wasNip04 = muteListEvent.content.includes('?iv=')
        const storedPlainText = await indexedDb.getDecryptedContent(muteListEvent.id)

        let plainText: string
        if (storedPlainText) {
          plainText = storedPlainText
        } else {
          plainText = wasNip04
            ? await nip04Decrypt(muteListEvent.pubkey, muteListEvent.content)
            : await nip44Decrypt(muteListEvent.pubkey, muteListEvent.content)
          await indexedDb.putDecryptedContent(muteListEvent.id, plainText)
        }

        const privateTags = z.array(z.array(z.string())).parse(JSON.parse(plainText))
        return { privateTags, wasNip04 }
      } catch (error) {
        console.error('Failed to decrypt mute list content', error)
        throw error
      }
    },
    [nip04Decrypt, nip44Decrypt]
  )

  const fetchLatestMuteListEvent = async (pubkey: string): Promise<Event | null> => {
    const remote = await client.fetchMuteListEvent(pubkey, true)
    const cached = await indexedDb.getReplaceableEvent(pubkey, kinds.Mutelist)
    if (cached && (!remote || cached.created_at >= remote.created_at)) return cached
    return remote
  }

  const migrateToNip44 = useCallback(
    async (muteListEvent: Event, privateTags: string[][]) => {
      if (!accountPubkey) return
      try {
        const latestEvent = await fetchLatestMuteListEvent(accountPubkey)
        if (
          migrationInProgress.current ||
          latestEvent?.id !== muteListEvent.id ||
          currentAccountPubkey.current !== accountPubkey
        )
          return
        const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(privateTags))
        if (currentAccountPubkey.current !== accountPubkey) return
        const newMuteListDraftEvent = createMuteListDraftEvent(muteListEvent.tags, cipherText)
        newMuteListDraftEvent.created_at = Math.max(
          newMuteListDraftEvent.created_at,
          muteListEvent.created_at + 1
        )
        const event = await publish(newMuteListDraftEvent)
        await updateMuteListEvent(event, privateTags)
      } catch (error) {
        console.error('[MuteList] Failed to migrate to NIP-44', error)
      }
    },
    [accountPubkey, nip44Encrypt, publish, updateMuteListEvent]
  )

  useEffect(() => {
    let cancelled = false
    const updateMuteTags = async () => {
      if (!muteListEvent || muteListEvent.pubkey !== accountPubkey) {
        setTags([])
        setPrivateTags([])
        return
      }

      const { privateTags, wasNip04 } = await getPrivateTags(muteListEvent).catch(() => ({
        privateTags: [] as string[][],
        wasNip04: false
      }))
      if (cancelled) return
      setPrivateTags(privateTags)
      setTags(muteListEvent.tags)

      if (wasNip04 && privateTags.length > 0) {
        migrateToNip44(muteListEvent, privateTags)
      }
    }
    updateMuteTags()
    return () => {
      cancelled = true
    }
  }, [accountPubkey, muteListEvent])

  const getMutePubkeys = () => {
    return Array.from(mutePubkeySet)
  }

  const getMuteType = useCallback(
    (pubkey: string): 'public' | 'private' | null => {
      if (publicMutePubkeySet.has(pubkey)) return 'public'
      if (privateMutePubkeySet.has(pubkey)) return 'private'
      return null
    },
    [publicMutePubkeySet, privateMutePubkeySet]
  )

  const publishWithPrivateTags = async (
    tags: string[][],
    privateTags: string[][],
    previousEvent?: Event | null
  ) => {
    if (!accountPubkey) throw new Error('You need to login first')
    const content = privateTags.length
      ? await nip44Encrypt(accountPubkey, JSON.stringify(privateTags))
      : ''
    if (currentAccountPubkey.current !== accountPubkey) throw new Error('Account changed')
    const draft = createMuteListDraftEvent(tags, content)
    draft.created_at = Math.max(draft.created_at, (previousEvent?.created_at ?? 0) + 1)
    const event = await publish(draft)
    await updateMuteListEvent(event, privateTags)
  }

  useEffect(() => {
    setMutedWordsMigrationFailed(false)
    const migrated = accountPubkey ? storage.hasMigratedMutedWords(accountPubkey) : false
    const legacyWords = Array.from(
      new Set(
        storage
          .getMutedWords()
          .map((word) => word.trim().toLowerCase())
          .filter(Boolean)
      )
    )
    setLegacyPendingWords(!accountPubkey || !migrated ? legacyWords : [])
    if (!accountPubkey || migrated || !legacyWords.length) return
    if (migrationInProgress.current) return

    migrationInProgress.current = true
    setChanging(true)
    const migrate = async () => {
      try {
        const event = await fetchLatestMuteListEvent(accountPubkey)
        const existingPrivateTags = event ? (await getPrivateTags(event)).privateTags : []
        const newPrivateTags = addLegacyMutedWords(existingPrivateTags, legacyWords)
        if (currentAccountPubkey.current !== accountPubkey) return
        if (newPrivateTags.length !== existingPrivateTags.length) {
          await publishWithPrivateTags(event?.tags ?? [], newPrivateTags, event)
        } else if (event) {
          await updateMuteListEvent(event, existingPrivateTags)
        }
        storage.markMutedWordsMigrated(accountPubkey)
        if (currentAccountPubkey.current === accountPubkey) setLegacyPendingWords([])
      } catch (error) {
        console.error('[MuteList] Failed to migrate local muted words', error)
        if (currentAccountPubkey.current === accountPubkey) setMutedWordsMigrationFailed(true)
      } finally {
        migrationInProgress.current = false
        setChanging(false)
        if (currentAccountPubkey.current !== accountPubkey) {
          setMigrationTick((tick) => tick + 1)
        }
      }
    }
    migrate()
  }, [accountPubkey, migrationTick])

  const updateMuteWord = async (
    word: string,
    visibility: 'public' | 'private',
    action: 'add' | 'remove'
  ): Promise<boolean> => {
    const normalized = word.trim().toLowerCase()
    if (!accountPubkey || !normalized || changing) return false
    setChanging(true)
    try {
      const event = await fetchLatestMuteListEvent(accountPubkey)
      if (!event && action === 'remove') return false
      if (!event) checkMuteListEvent(event)
      const existingPrivateTags = event ? (await getPrivateTags(event)).privateTags : []
      const { publicTags, privateTags } = updateMutedWordTag(
        event?.tags ?? [],
        existingPrivateTags,
        normalized,
        visibility,
        action
      )
      if (currentAccountPubkey.current !== accountPubkey) return false
      await publishWithPrivateTags(publicTags, privateTags, event)
      return true
    } catch (error) {
      formatError(error).forEach((message) =>
        toast.error(t('Failed to update muted word') + ': ' + message, { duration: 10_000 })
      )
      return false
    } finally {
      setChanging(false)
    }
  }

  const refreshMuteWords = async () => {
    if (!accountPubkey || changing) return
    try {
      const event = await fetchLatestMuteListEvent(accountPubkey)
      if (!event || currentAccountPubkey.current !== accountPubkey) return
      const { privateTags } = await getPrivateTags(event)
      await updateMuteListEvent(event, privateTags)
    } catch (error) {
      console.error('[MuteList] Failed to refresh muted words', error)
    }
  }

  const checkMuteListEvent = (muteListEvent: Event | null) => {
    if (!muteListEvent) {
      const result = confirm(t('MuteListNotFoundConfirmation'))

      if (!result) {
        throw new Error('Mute list not found')
      }
    }
  }

  const mutePubkeyPublicly = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await fetchLatestMuteListEvent(accountPubkey)
      checkMuteListEvent(muteListEvent)
      if (
        muteListEvent &&
        muteListEvent.tags.some(([tagName, tagValue]) => tagName === 'p' && tagValue === pubkey)
      ) {
        return
      }
      const newTags = (muteListEvent?.tags ?? []).concat([['p', pubkey]])
      const { privateTags } = muteListEvent
        ? await getPrivateTags(muteListEvent)
        : { privateTags: [] }
      await publishWithPrivateTags(newTags, privateTags, muteListEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(t('Failed to mute user publicly') + ': ' + err, { duration: 10_000 })
      })
    } finally {
      setChanging(false)
    }
  }

  const mutePubkeyPrivately = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await fetchLatestMuteListEvent(accountPubkey)
      checkMuteListEvent(muteListEvent)
      const { privateTags } = muteListEvent
        ? await getPrivateTags(muteListEvent)
        : { privateTags: [] as string[][] }
      if (privateTags.some(([tagName, tagValue]) => tagName === 'p' && tagValue === pubkey)) {
        return
      }

      const newPrivateTags = privateTags.concat([['p', pubkey]])
      await publishWithPrivateTags(muteListEvent?.tags ?? [], newPrivateTags, muteListEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(t('Failed to mute user privately') + ': ' + err, { duration: 10_000 })
      })
    } finally {
      setChanging(false)
    }
  }

  const unmutePubkey = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await fetchLatestMuteListEvent(accountPubkey)
      if (!muteListEvent) return

      const { privateTags } = await getPrivateTags(muteListEvent)
      const newPrivateTags = privateTags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
      await publishWithPrivateTags(
        muteListEvent.tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey),
        newPrivateTags,
        muteListEvent
      )
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(t('Failed to unmute user') + ': ' + err, { duration: 10_000 })
      })
    } finally {
      setChanging(false)
    }
  }

  const switchToPublicMute = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await fetchLatestMuteListEvent(accountPubkey)
      if (!muteListEvent) return

      const { privateTags } = await getPrivateTags(muteListEvent)
      const newPrivateTags = privateTags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
      if (newPrivateTags.length === privateTags.length) {
        return
      }

      await publishWithPrivateTags(
        muteListEvent.tags
          .filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
          .concat([['p', pubkey]]),
        newPrivateTags,
        muteListEvent
      )
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(t('Failed to switch to public mute') + ': ' + err, { duration: 10_000 })
      })
    } finally {
      setChanging(false)
    }
  }

  const switchToPrivateMute = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await fetchLatestMuteListEvent(accountPubkey)
      if (!muteListEvent) return

      const newTags = muteListEvent.tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
      if (newTags.length === muteListEvent.tags.length) {
        return
      }

      const { privateTags } = await getPrivateTags(muteListEvent)
      const newPrivateTags = privateTags
        .filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
        .concat([['p', pubkey]])
      await publishWithPrivateTags(newTags, newPrivateTags, muteListEvent)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(t('Failed to switch to private mute') + ': ' + err, { duration: 10_000 })
      })
    } finally {
      setChanging(false)
    }
  }

  return (
    <MuteListContext.Provider
      value={{
        mutePubkeySet,
        changing,
        getMutePubkeys,
        getMuteType,
        mutePubkeyPublicly,
        mutePubkeyPrivately,
        unmutePubkey,
        switchToPublicMute,
        switchToPrivateMute,
        mutedWords,
        publicMutedWords,
        privateMutedWords,
        mutedWordsMigrationFailed,
        retryMutedWordsMigration: () => setMigrationTick((tick) => tick + 1),
        addMuteWord: (word, visibility) => updateMuteWord(word, visibility, 'add'),
        removeMuteWord: (word, visibility) => updateMuteWord(word, visibility, 'remove'),
        refreshMuteWords
      }}
    >
      {children}
    </MuteListContext.Provider>
  )
}
