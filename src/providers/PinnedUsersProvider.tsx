import { ExtendedKind } from '@/constants'
import { formatError } from '@/lib/error'
import { getPubkeysFromPTags } from '@/lib/tag'
import indexedDb from '@/services/indexed-db.service'
import { Event } from 'nostr-tools'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useNostr } from './NostrProvider'

type TPinnedUsersContext = {
  pinnedPubkeySet: Set<string>
  isPinned: (pubkey: string) => boolean
  pinUser: (pubkey: string) => Promise<void>
  unpinUser: (pubkey: string) => Promise<void>
  togglePin: (pubkey: string) => Promise<void>
}

const PinnedUsersContext = createContext<TPinnedUsersContext | undefined>(undefined)

export const usePinnedUsers = () => {
  const context = useContext(PinnedUsersContext)
  if (!context) {
    throw new Error('usePinnedUsers must be used within a PinnedUsersProvider')
  }
  return context
}

function createPinnedUsersListDraftEvent(tags: string[][], content = '') {
  return {
    kind: ExtendedKind.PINNED_USERS,
    content,
    tags,
    created_at: Math.floor(Date.now() / 1000)
  }
}

export function PinnedUsersProvider({ children }: { children: React.ReactNode }) {
  const {
    pubkey: accountPubkey,
    pinnedUsersEvent,
    updatePinnedUsersEvent,
    publish,
    nip04Decrypt,
    nip44Encrypt,
    nip44Decrypt
  } = useNostr()
  const [privateTags, setPrivateTags] = useState<string[][]>([])
  const pinnedPubkeySet = useMemo(() => {
    if (!pinnedUsersEvent) return new Set<string>()
    return new Set(getPubkeysFromPTags(pinnedUsersEvent.tags.concat(privateTags)))
  }, [pinnedUsersEvent, privateTags])

  const migrateToNip44 = useCallback(
    async (event: Event, privateTags: string[][]) => {
      if (!accountPubkey) return
      console.log('[PinnedUsers] Migrating from NIP-04 to NIP-44, privateTags count:', privateTags.length)
      try {
        const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(privateTags))
        const draftEvent = createPinnedUsersListDraftEvent(event.tags, cipherText)
        const newEvent = await publish(draftEvent)
        console.log('[PinnedUsers] Migration successful, new event id:', newEvent.id)
        await updatePinnedUsersEvent(newEvent, privateTags)
      } catch (error) {
        console.error('[PinnedUsers] Failed to migrate to NIP-44', error)
      }
    },
    [accountPubkey, nip44Encrypt, publish, updatePinnedUsersEvent]
  )

  useEffect(() => {
    const updatePrivateTags = async () => {
      if (!pinnedUsersEvent) {
        setPrivateTags([])
        return
      }

      const { privateTags, wasNip04 } = await getPrivateTags(pinnedUsersEvent).catch(() => ({
        privateTags: [] as string[][],
        wasNip04: false
      }))
      setPrivateTags(privateTags)

      if (wasNip04 && privateTags.length > 0) {
        migrateToNip44(pinnedUsersEvent, privateTags)
      }
    }
    updatePrivateTags()
  }, [pinnedUsersEvent])

  const getPrivateTags = useCallback(
    async (event: Event): Promise<{ privateTags: string[][]; wasNip04: boolean }> => {
      if (!event.content) return { privateTags: [], wasNip04: false }

      try {
        const wasNip04 = event.content.includes('?iv=')
        const storedPlainText = await indexedDb.getDecryptedContent(event.id)

        let plainText: string
        if (storedPlainText) {
          console.log('[PinnedUsers] Using cached decrypted content for event', event.id)
          plainText = storedPlainText
        } else {
          console.log('[PinnedUsers] Decrypting content with', wasNip04 ? 'NIP-04' : 'NIP-44', 'for event', event.id)
          plainText = wasNip04
            ? await nip04Decrypt(event.pubkey, event.content)
            : await nip44Decrypt(event.pubkey, event.content)
          await indexedDb.putDecryptedContent(event.id, plainText)
        }

        const privateTags = z.array(z.array(z.string())).parse(JSON.parse(plainText))
        console.log('[PinnedUsers] Decrypted privateTags count:', privateTags.length, 'wasNip04:', wasNip04)
        return { privateTags, wasNip04 }
      } catch (error) {
        console.error('Failed to decrypt pinned users content', error)
        return { privateTags: [], wasNip04: false }
      }
    },
    [nip04Decrypt, nip44Decrypt]
  )

  const isPinned = useCallback(
    (pubkey: string) => {
      return pinnedPubkeySet.has(pubkey)
    },
    [pinnedPubkeySet]
  )

  const pinUser = useCallback(
    async (pubkey: string) => {
      if (!accountPubkey || isPinned(pubkey)) return

      try {
        const newTags = [...(pinnedUsersEvent?.tags ?? []), ['p', pubkey]]
        const draftEvent = createPinnedUsersListDraftEvent(newTags, pinnedUsersEvent?.content ?? '')
        const newEvent = await publish(draftEvent)
        await updatePinnedUsersEvent(newEvent, privateTags)
      } catch (error) {
        const errors = formatError(error)
        errors.forEach((err) => {
          toast.error(`Failed to pin user: ${err}`, { duration: 10_000 })
        })
      }
    },
    [accountPubkey, isPinned, pinnedUsersEvent, publish, updatePinnedUsersEvent, privateTags]
  )

  const unpinUser = useCallback(
    async (pubkey: string) => {
      if (!accountPubkey || !pinnedUsersEvent || !isPinned(pubkey)) return

      try {
        const newTags = pinnedUsersEvent.tags.filter(
          ([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey
        )
        const newPrivateTags = privateTags.filter(
          ([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey
        )
        let newContent = pinnedUsersEvent.content
        if (newPrivateTags.length !== privateTags.length) {
          newContent = await nip44Encrypt(pinnedUsersEvent.pubkey, JSON.stringify(newPrivateTags))
        }
        const draftEvent = createPinnedUsersListDraftEvent(newTags, newContent)
        const newEvent = await publish(draftEvent)
        await updatePinnedUsersEvent(newEvent, newPrivateTags)
      } catch (error) {
        const errors = formatError(error)
        errors.forEach((err) => {
          toast.error(`Failed to unpin user: ${err}`, { duration: 10_000 })
        })
      }
    },
    [
      accountPubkey,
      isPinned,
      pinnedUsersEvent,
      publish,
      updatePinnedUsersEvent,
      privateTags,
      nip44Encrypt
    ]
  )

  const togglePin = useCallback(
    async (pubkey: string) => {
      if (isPinned(pubkey)) {
        await unpinUser(pubkey)
      } else {
        await pinUser(pubkey)
      }
    },
    [isPinned, pinUser, unpinUser]
  )

  return (
    <PinnedUsersContext.Provider
      value={{
        pinnedPubkeySet,
        isPinned,
        pinUser,
        unpinUser,
        togglePin
      }}
    >
      {children}
    </PinnedUsersContext.Provider>
  )
}
