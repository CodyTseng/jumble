import { createFollowListDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { canStorePrivateFollowsInContent } from '@/lib/private-follow'
import { publishTabSync, subscribeTabSync, TabSyncType } from '@/lib/tab-sync'
import { getPubkeysFromPTags } from '@/lib/tag'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import { Event } from 'nostr-tools'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useNostr } from './NostrProvider'

type TFollowListContext = {
  /** Public + private follows (for feed / isFollowing checks) */
  followingSet: Set<string>
  publicFollowingSet: Set<string>
  privateFollowingSet: Set<string>
  follow: (pubkey: string) => Promise<void>
  followPrivately: (pubkey: string) => Promise<void>
  unfollow: (pubkey: string) => Promise<void>
  getFollowType: (pubkey: string) => 'public' | 'private' | null
  switchToPrivateFollow: (pubkey: string) => Promise<void>
  switchToPublicFollow: (pubkey: string) => Promise<void>
  /** Move every public follow into the private (encrypted) set */
  convertAllPublicFollowsToPrivate: () => Promise<void>
}

const FollowListContext = createContext<TFollowListContext | undefined>(undefined)

export const useFollowList = () => {
  const context = useContext(FollowListContext)
  if (!context) {
    throw new Error('useFollowList must be used within a FollowListProvider')
  }
  return context
}

/**
 * Parse private follow `p` tags from kind-3 content when it is a NIP-44/NIP-04
 * ciphertext of a JSON string[][] (same convention as mute lists).
 * If content is a NIP-02 relay preference map, returns empty private tags.
 */
async function decryptPrivateFollowTags(
  followListEvent: Event,
  nip04Decrypt: (pubkey: string, cipher: string) => Promise<string>,
  nip44Decrypt: (pubkey: string, cipher: string) => Promise<string>
): Promise<{ privateTags: string[][]; wasNip04: boolean }> {
  if (!followListEvent.content) return { privateTags: [], wasNip04: false }

  // Classic NIP-02 relay map starts with `{` and is not encrypted - leave alone
  const trimmed = followListEvent.content.trim()
  if (trimmed.startsWith('{') && !trimmed.includes('?iv=')) {
    try {
      JSON.parse(trimmed)
      return { privateTags: [], wasNip04: false }
    } catch {
      // not valid JSON map - try decrypt path
    }
  }

  try {
    const wasNip04 = followListEvent.content.includes('?iv=')
    const storedPlainText = await indexedDb.getDecryptedContent(followListEvent.id)
    let plainText: string
    if (storedPlainText) {
      plainText = storedPlainText
    } else {
      plainText = wasNip04
        ? await nip04Decrypt(followListEvent.pubkey, followListEvent.content)
        : await nip44Decrypt(followListEvent.pubkey, followListEvent.content)
      await indexedDb.putDecryptedContent(followListEvent.id, plainText)
    }
    const privateTags = z.array(z.array(z.string())).parse(JSON.parse(plainText))
    return { privateTags, wasNip04 }
  } catch (error) {
    console.error('Failed to decrypt private follow tags', error)
    return { privateTags: [], wasNip04: false }
  }
}

export function FollowListProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const {
    pubkey: accountPubkey,
    followListEvent,
    publish,
    updateFollowListEvent,
    nip04Decrypt,
    nip44Encrypt,
    nip44Decrypt
  } = useNostr()
  const [privateTags, setPrivateTags] = useState<string[][]>([])

  const publicFollowingSet = useMemo(
    () => new Set(followListEvent ? getPubkeysFromPTags(followListEvent.tags) : []),
    [followListEvent]
  )
  const privateFollowingSet = useMemo(() => new Set(getPubkeysFromPTags(privateTags)), [privateTags])
  const followingSet = useMemo(
    () => new Set([...Array.from(publicFollowingSet), ...Array.from(privateFollowingSet)]),
    [publicFollowingSet, privateFollowingSet]
  )

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      if (!followListEvent) {
        setPrivateTags([])
        return
      }
      const { privateTags: tags } = await decryptPrivateFollowTags(
        followListEvent,
        nip04Decrypt,
        nip44Decrypt
      )
      if (!cancelled) setPrivateTags(tags)
    }
    run()
    return () => {
      cancelled = true
    }
  }, [followListEvent, nip04Decrypt, nip44Decrypt])

  // Cross-tab sync: when another tab updates the follow list, reload from cache/network
  useEffect(() => {
    if (!accountPubkey) return
    return subscribeTabSync(async (msg) => {
      if (msg.type !== TabSyncType.FOLLOW_LIST_UPDATED) return
      if (msg.accountPubkey && msg.accountPubkey !== accountPubkey) return
      try {
        const evt = await client.fetchFollowListEvent(accountPubkey)
        if (evt) await updateFollowListEvent(evt)
      } catch (error) {
        console.error('[FollowList] cross-tab refresh failed', error)
      }
    })
  }, [accountPubkey, updateFollowListEvent])

  const broadcastFollowUpdate = useCallback(() => {
    if (!accountPubkey) return
    publishTabSync({
      type: TabSyncType.FOLLOW_LIST_UPDATED,
      accountPubkey
    })
  }, [accountPubkey])

  const getFollowType = useCallback(
    (pubkey: string): 'public' | 'private' | null => {
      if (publicFollowingSet.has(pubkey)) return 'public'
      if (privateFollowingSet.has(pubkey)) return 'private'
      return null
    },
    [publicFollowingSet, privateFollowingSet]
  )

  const encryptPrivateTags = async (tags: string[][]) => {
    if (!accountPubkey) return ''
    if (tags.length === 0) return ''
    return nip44Encrypt(accountPubkey, JSON.stringify(tags))
  }

  /**
   * When kind-3 content is a NIP-02 relay preference map, we must not overwrite it.
   * Private follow tags are only stored when content is empty or already our ciphertext.
   * If a relay map is present, private follow writes are refused with a toast.
   * Most Jumble-created lists have empty content and support private follows.
   */
  const canStorePrivateInContent = canStorePrivateFollowsInContent

  const follow = async (pubkey: string) => {
    if (!accountPubkey) return

    const current = await client.fetchFollowListEvent(accountPubkey)
    if (!current) {
      const result = confirm(t('FollowListNotFoundConfirmation'))
      if (!result) return
    }
    if (current?.tags.some(([n, v]) => n === 'p' && v === pubkey)) return

    const newFollowListDraftEvent = createFollowListDraftEvent(
      (current?.tags ?? []).concat([['p', pubkey]]),
      current?.content
    )
    try {
      const newFollowListEvent = await publish(newFollowListDraftEvent)
      if (newFollowListEvent.pubkey !== accountPubkey) return
      await updateFollowListEvent(newFollowListEvent)
      broadcastFollowUpdate()
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to follow: ${err}`, { duration: 10_000 })
      })
    }
  }

  const followPrivately = async (pubkey: string) => {
    if (!accountPubkey) return
    if (privateFollowingSet.has(pubkey) || publicFollowingSet.has(pubkey)) return

    const current = await client.fetchFollowListEvent(accountPubkey)
    if (!current) {
      const result = confirm(t('FollowListNotFoundConfirmation'))
      if (!result) return
    }
    if (!canStorePrivateInContent(current?.content)) {
      toast.error(
        t('Private follows unavailable while follow list stores relay preferences in content'),
        { duration: 10_000 }
      )
      return
    }

    const { privateTags: existing } = current
      ? await decryptPrivateFollowTags(current, nip04Decrypt, nip44Decrypt)
      : { privateTags: [] as string[][] }
    if (existing.some(([n, v]) => n === 'p' && v === pubkey)) return

    const newPrivateTags = existing.concat([['p', pubkey]])
    const cipherText = await encryptPrivateTags(newPrivateTags)
    try {
      const draft = createFollowListDraftEvent(current?.tags ?? [], cipherText)
      const newEvent = await publish(draft)
      if (newEvent.pubkey !== accountPubkey) return
      await indexedDb.putDecryptedContent(newEvent.id, JSON.stringify(newPrivateTags))
      await updateFollowListEvent(newEvent)
      setPrivateTags(newPrivateTags)
      broadcastFollowUpdate()
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to follow privately: ${err}`, { duration: 10_000 })
      })
    }
  }

  const unfollow = async (pubkey: string) => {
    if (!accountPubkey) return

    const current = await client.fetchFollowListEvent(accountPubkey)
    if (!current) return

    const { privateTags: existing } = await decryptPrivateFollowTags(
      current,
      nip04Decrypt,
      nip44Decrypt
    )
    const newPublicTags = current.tags.filter(([n, v]) => n !== 'p' || v !== pubkey)
    const newPrivateTags = existing.filter(([n, v]) => n !== 'p' || v !== pubkey)

    let content = current.content
    if (newPrivateTags.length !== existing.length) {
      if (!canStorePrivateInContent(current.content) && existing.length > 0) {
        // keep content as-is if we cannot rewrite; still remove public tags
      } else {
        content = await encryptPrivateTags(newPrivateTags)
      }
    }

    const draft = createFollowListDraftEvent(newPublicTags, content)
    try {
      const newEvent = await publish(draft)
      if (newEvent.pubkey !== accountPubkey) return
      if (newPrivateTags.length !== existing.length && canStorePrivateInContent(current.content)) {
        await indexedDb.putDecryptedContent(newEvent.id, JSON.stringify(newPrivateTags))
        setPrivateTags(newPrivateTags)
      }
      await updateFollowListEvent(newEvent)
      broadcastFollowUpdate()
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to unfollow: ${err}`, { duration: 10_000 })
      })
    }
  }

  const switchToPrivateFollow = async (pubkey: string) => {
    if (!accountPubkey || !publicFollowingSet.has(pubkey)) return
    const current = await client.fetchFollowListEvent(accountPubkey)
    if (!current) return
    if (!canStorePrivateInContent(current.content)) {
      toast.error(
        t('Private follows unavailable while follow list stores relay preferences in content'),
        { duration: 10_000 }
      )
      return
    }
    const { privateTags: existing } = await decryptPrivateFollowTags(
      current,
      nip04Decrypt,
      nip44Decrypt
    )
    const newPublicTags = current.tags.filter(([n, v]) => n !== 'p' || v !== pubkey)
    const newPrivateTags = existing
      .filter(([n, v]) => n !== 'p' || v !== pubkey)
      .concat([['p', pubkey]])
    const cipherText = await encryptPrivateTags(newPrivateTags)
    try {
      const newEvent = await publish(createFollowListDraftEvent(newPublicTags, cipherText))
      if (newEvent.pubkey !== accountPubkey) return
      await indexedDb.putDecryptedContent(newEvent.id, JSON.stringify(newPrivateTags))
      setPrivateTags(newPrivateTags)
      await updateFollowListEvent(newEvent)
      broadcastFollowUpdate()
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => toast.error(`Failed to switch to private follow: ${err}`, { duration: 10_000 }))
    }
  }

  const switchToPublicFollow = async (pubkey: string) => {
    if (!accountPubkey || !privateFollowingSet.has(pubkey)) return
    const current = await client.fetchFollowListEvent(accountPubkey)
    if (!current) return
    const { privateTags: existing } = await decryptPrivateFollowTags(
      current,
      nip04Decrypt,
      nip44Decrypt
    )
    const newPrivateTags = existing.filter(([n, v]) => n !== 'p' || v !== pubkey)
    const newPublicTags = current.tags
      .filter(([n, v]) => n !== 'p' || v !== pubkey)
      .concat([['p', pubkey]])
    const cipherText = await encryptPrivateTags(newPrivateTags)
    try {
      const newEvent = await publish(createFollowListDraftEvent(newPublicTags, cipherText))
      if (newEvent.pubkey !== accountPubkey) return
      await indexedDb.putDecryptedContent(newEvent.id, JSON.stringify(newPrivateTags))
      setPrivateTags(newPrivateTags)
      await updateFollowListEvent(newEvent)
      broadcastFollowUpdate()
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => toast.error(`Failed to switch to public follow: ${err}`, { duration: 10_000 }))
    }
  }

  const convertAllPublicFollowsToPrivate = async () => {
    if (!accountPubkey) return
    const current = await client.fetchFollowListEvent(accountPubkey)
    if (!current) return
    if (!canStorePrivateInContent(current.content)) {
      toast.error(
        t('Private follows unavailable while follow list stores relay preferences in content'),
        { duration: 10_000 }
      )
      return
    }
    const publicPs = current.tags.filter(([n]) => n === 'p')
    if (publicPs.length === 0) {
      toast.message(t('No public follows to convert'))
      return
    }
    const { privateTags: existing } = await decryptPrivateFollowTags(
      current,
      nip04Decrypt,
      nip44Decrypt
    )
    const privateSet = new Set(getPubkeysFromPTags(existing))
    const mergedPrivate = [...existing]
    for (const tag of publicPs) {
      if (!privateSet.has(tag[1])) {
        mergedPrivate.push(['p', tag[1]])
        privateSet.add(tag[1])
      }
    }
    const nonPTags = current.tags.filter(([n]) => n !== 'p')
    const cipherText = await encryptPrivateTags(mergedPrivate)
    try {
      const newEvent = await publish(createFollowListDraftEvent(nonPTags, cipherText))
      if (newEvent.pubkey !== accountPubkey) return
      await indexedDb.putDecryptedContent(newEvent.id, JSON.stringify(mergedPrivate))
      setPrivateTags(mergedPrivate)
      await updateFollowListEvent(newEvent)
      broadcastFollowUpdate()
      toast.success(t('Converted public follows to private'))
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => toast.error(`Failed to convert follows: ${err}`, { duration: 10_000 }))
    }
  }

  return (
    <FollowListContext.Provider
      value={{
        followingSet,
        publicFollowingSet,
        privateFollowingSet,
        follow,
        followPrivately,
        unfollow,
        getFollowType,
        switchToPrivateFollow,
        switchToPublicFollow,
        convertAllPublicFollowsToPrivate
      }}
    >
      {children}
    </FollowListContext.Provider>
  )
}
