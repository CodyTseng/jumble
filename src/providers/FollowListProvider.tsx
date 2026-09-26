import { ExtendedKind } from '@/constants'
import { createFollowListDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { getPubkeysFromPTags } from '@/lib/tag'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { useNostr } from './NostrProvider'

function createPrivateFollowListDraftEvent(content = '') {
  return {
    kind: ExtendedKind.PRIVATE_FOLLOWS,
    content,
    tags: [],
    created_at: Math.floor(Date.now() / 1000)
  }
}

type TFollowListContext = {
  followingSet: Set<string>
  privateFollowingSet: Set<string>
  isPrivateFollowing: (pubkey: string) => boolean
  follow: (pubkey: string, options?: { isPrivate?: boolean }) => Promise<void>
  unfollow: (pubkey: string) => Promise<void>
  moveToPrivate: (pubkey: string) => Promise<void>
  moveToPublic: (pubkey: string) => Promise<void>
  convertAllToPrivate: () => Promise<void>
}

const FollowListContext = createContext<TFollowListContext | undefined>(undefined)

export const useFollowList = () => {
  const context = useContext(FollowListContext)
  if (!context) {
    throw new Error('useFollowList must be used within a FollowListProvider')
  }
  return context
}

export function FollowListProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const {
    pubkey: accountPubkey,
    followListEvent,
    privateFollowListEvent,
    publish,
    updateFollowListEvent,
    updatePrivateFollowListEvent,
    nip44Encrypt,
    nip44Decrypt
  } = useNostr()
  const [privateTags, setPrivateTags] = useState<string[][]>([])

  const privateFollowingSet = useMemo(() => new Set(getPubkeysFromPTags(privateTags)), [privateTags])
  const followingSet = useMemo(
    () =>
      new Set([
        ...(followListEvent ? getPubkeysFromPTags(followListEvent.tags) : []),
        ...getPubkeysFromPTags(privateTags)
      ]),
    [followListEvent, privateTags]
  )

  useEffect(() => {
    const updatePrivateTags = async () => {
      if (!privateFollowListEvent || !privateFollowListEvent.content) {
        setPrivateTags([])
        return
      }

      try {
        const storedPlainText = await indexedDb.getDecryptedContent(privateFollowListEvent.id)
        let plainText: string
        if (storedPlainText) {
          plainText = storedPlainText
        } else {
          plainText = await nip44Decrypt(privateFollowListEvent.pubkey, privateFollowListEvent.content)
          await indexedDb.putDecryptedContent(privateFollowListEvent.id, plainText)
        }
        const tags = z.array(z.array(z.string())).parse(JSON.parse(plainText))
        setPrivateTags(tags)
      } catch (error) {
        console.error('Failed to decrypt private follow list content', error)
        setPrivateTags([])
      }
    }
    updatePrivateTags()
  }, [privateFollowListEvent, nip44Decrypt])

  const publishPrivateTags = useCallback(
    async (newPrivateTags: string[][]) => {
      if (!accountPubkey) return false
      const newContent = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const draftEvent = createPrivateFollowListDraftEvent(newContent)
      const newEvent = await publish(draftEvent)
      if (newEvent.pubkey !== accountPubkey) return false
      await updatePrivateFollowListEvent(newEvent, newPrivateTags)
      return true
    },
    [accountPubkey, nip44Encrypt, publish, updatePrivateFollowListEvent]
  )

  const publishPublicTags = useCallback(
    async (newTags: string[][], content?: string) => {
      if (!accountPubkey) return false
      const newFollowListDraftEvent = createFollowListDraftEvent(newTags, content)
      const newFollowListEvent = await publish(newFollowListDraftEvent)
      if (newFollowListEvent.pubkey !== accountPubkey) return false
      await updateFollowListEvent(newFollowListEvent)
      return true
    },
    [accountPubkey, publish, updateFollowListEvent]
  )

  // always operate on a freshly-fetched kind-3 so we never clobber follows
  // added from another client between page loads
  const fetchFreshPublicEvent = useCallback(async () => {
    if (!accountPubkey) return null
    return await client.fetchFollowListEvent(accountPubkey)
  }, [accountPubkey])

  const isPrivateFollowing = useCallback(
    (pubkey: string) => privateFollowingSet.has(pubkey),
    [privateFollowingSet]
  )

  const follow = async (pubkey: string, options?: { isPrivate?: boolean }) => {
    if (!accountPubkey) return

    try {
      if (options?.isPrivate) {
        if (privateFollowingSet.has(pubkey)) return
        const ok = await publishPrivateTags([...privateTags, ['p', pubkey]])
        if (!ok) return
      } else {
        const freshEvent = await fetchFreshPublicEvent()
        if (!freshEvent) {
          const result = confirm(t('FollowListNotFoundConfirmation'))
          if (!result) return
        }
        const currentTags = freshEvent?.tags ?? []
        if (getPubkeysFromPTags(currentTags).includes(pubkey)) return
        const ok = await publishPublicTags(currentTags.concat([['p', pubkey]]), freshEvent?.content)
        if (!ok) return
      }
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to follow: ${err}`, { duration: 10_000 })
      })
    }
  }

  const unfollow = async (pubkey: string) => {
    if (!accountPubkey) return

    try {
      if (privateFollowingSet.has(pubkey)) {
        const newPrivateTags = privateTags.filter(
          ([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey
        )
        const ok = await publishPrivateTags(newPrivateTags)
        if (!ok) return
        return
      }

      const freshEvent = await fetchFreshPublicEvent()
      if (!freshEvent) return
      await publishPublicTags(
        freshEvent.tags.filter(([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey),
        freshEvent.content
      )
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to unfollow: ${err}`, { duration: 10_000 })
      })
    }
  }

  const moveToPrivate = async (pubkey: string) => {
    if (!accountPubkey) return
    if (privateFollowingSet.has(pubkey)) return

    try {
      // add to the encrypted private list first, so a failed second step never loses the follow
      const ok = await publishPrivateTags([...privateTags, ['p', pubkey]])
      if (!ok) return

      const freshEvent = await fetchFreshPublicEvent()
      if (freshEvent && getPubkeysFromPTags(freshEvent.tags).includes(pubkey)) {
        await publishPublicTags(
          freshEvent.tags.filter(([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey),
          freshEvent.content
        )
      }
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to move follow to private: ${err}`, { duration: 10_000 })
      })
    }
  }

  const moveToPublic = async (pubkey: string) => {
    if (!accountPubkey) return
    if (!privateFollowingSet.has(pubkey)) return

    try {
      // add to the public kind-3 list first, so a failed second step never loses the follow
      const freshEvent = await fetchFreshPublicEvent()
      const currentTags = freshEvent?.tags ?? []
      if (!getPubkeysFromPTags(currentTags).includes(pubkey)) {
        const ok = await publishPublicTags(currentTags.concat([['p', pubkey]]), freshEvent?.content)
        if (!ok) return
      }

      const newPrivateTags = privateTags.filter(
        ([tagName, tagValue]) => tagName !== 'p' || tagValue !== pubkey
      )
      await publishPrivateTags(newPrivateTags)
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to move follow to public: ${err}`, { duration: 10_000 })
      })
    }
  }

  const convertAllToPrivate = async () => {
    if (!accountPubkey) return

    const freshEvent = await fetchFreshPublicEvent()
    const publicTags = freshEvent?.tags ?? []
    const publicPubkeys = getPubkeysFromPTags(publicTags)
    if (publicPubkeys.length === 0) return

    try {
      const existingPrivate = new Set(getPubkeysFromPTags(privateTags))
      const mergedPrivateTags = [...privateTags]
      publicPubkeys.forEach((pk) => {
        if (!existingPrivate.has(pk)) {
          mergedPrivateTags.push(['p', pk])
        }
      })
      // private list first, so a failed second step never loses follows
      const ok = await publishPrivateTags(mergedPrivateTags)
      if (!ok) return
      await publishPublicTags(publicTags.filter(([tagName]) => tagName !== 'p'), freshEvent?.content)
      toast.success(t('All follows moved to private'))
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`Failed to convert follows to private: ${err}`, { duration: 10_000 })
      })
    }
  }

  return (
    <FollowListContext.Provider
      value={{
        followingSet,
        privateFollowingSet,
        isPrivateFollowing,
        follow,
        unfollow,
        moveToPrivate,
        moveToPublic,
        convertAllToPrivate
      }}
    >
      {children}
    </FollowListContext.Provider>
  )
}
