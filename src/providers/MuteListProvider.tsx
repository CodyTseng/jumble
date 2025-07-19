import { createMuteListDraftEvent } from '@/lib/draft-event'
import { getPubkeysFromPTags } from '@/lib/tag'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { z } from 'zod'
import { useNostr } from './NostrProvider'
import { useTranslation } from 'react-i18next'

type TMuteListContext = {
  mutePubkeys: string[]
  changing: boolean
  getMutePubkeys: () => string[]
  getMuteType: (pubkey: string) => 'public' | 'private' | null
  mutePubkeyPublicly: (pubkey: string) => Promise<void>
  mutePubkeyPrivately: (pubkey: string) => Promise<void>
  unmutePubkey: (pubkey: string) => Promise<void>
  switchToPublicMute: (pubkey: string) => Promise<void>
  switchToPrivateMute: (pubkey: string) => Promise<void>
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
    nip04Encrypt
  } = useNostr()
  const [tags, setTags] = useState<string[][]>([])
  const [privateTags, setPrivateTags] = useState<string[][]>([])
  const publicMutePubkeySet = useMemo(() => new Set(getPubkeysFromPTags(tags)), [tags])
  const privateMutePubkeySet = useMemo(
    () => new Set(getPubkeysFromPTags(privateTags)),
    [privateTags]
  )
  const mutePubkeys = useMemo(() => {
    return Array.from(
      new Set([...Array.from(privateMutePubkeySet), ...Array.from(publicMutePubkeySet)])
    )
  }, [publicMutePubkeySet, privateMutePubkeySet])
  const [changing, setChanging] = useState(false)

  const getPrivateTags = async (muteListEvent: Event) => {
    if (!muteListEvent.content) return []

    const storedDecryptedTags = await indexedDb.getMuteDecryptedTags(muteListEvent.id)

    if (storedDecryptedTags) {
      return storedDecryptedTags
    } else {
      try {
        const plainText = await nip04Decrypt(muteListEvent.pubkey, muteListEvent.content)
        const privateTags = z.array(z.array(z.string())).parse(JSON.parse(plainText))
        await indexedDb.putMuteDecryptedTags(muteListEvent.id, privateTags)
        return privateTags
      } catch (error) {
        console.error('Failed to decrypt mute list content', error)
        return []
      }
    }
  }

  useEffect(() => {
    const updateMuteTags = async () => {
      if (!muteListEvent) {
        setTags([])
        setPrivateTags([])
        return
      }

      const privateTags = await getPrivateTags(muteListEvent).catch(() => {
        return []
      })
      setPrivateTags(privateTags)
      setTags(muteListEvent.tags)
    }
    updateMuteTags()
  }, [muteListEvent])

  const getMutePubkeys = () => {
    return mutePubkeys
  }

  const getMuteType = useCallback(
    (pubkey: string): 'public' | 'private' | null => {
      if (publicMutePubkeySet.has(pubkey)) return 'public'
      if (privateMutePubkeySet.has(pubkey)) return 'private'
      return null
    },
    [publicMutePubkeySet, privateMutePubkeySet]
  )

  const publishNewMuteListEvent = async (tags: string[][], content?: string) => {
    if (dayjs().unix() === muteListEvent?.created_at) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    const newMuteListDraftEvent = createMuteListDraftEvent(tags, content)
    const event = await publish(newMuteListDraftEvent)
    toast.success(t('Successfully updated mute list'))
    return event
  }

  const mutePubkeyPublicly = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
      if (
        muteListEvent &&
        muteListEvent.tags.some(([tagName, tagValue]) => tagName === 'p' && tagValue === pubkey)
      ) {
        return
      }
      const newTags = (muteListEvent?.tags ?? []).concat([['p', pubkey]])
      const newMuteListEvent = await publishNewMuteListEvent(newTags, muteListEvent?.content)
      const privateTags = await getPrivateTags(newMuteListEvent)
      await updateMuteListEvent(newMuteListEvent, privateTags)
    } finally {
      setChanging(false)
    }
  }

  const mutePubkeyPrivately = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
      const privateTags = muteListEvent ? await getPrivateTags(muteListEvent) : []
      if (privateTags.some(([tagName, tagValue]) => tagName === 'p' && tagValue === pubkey)) {
        return
      }

      const newPrivateTags = privateTags.concat([['p', pubkey]])
      const cipherText = await nip04Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(muteListEvent?.tags ?? [], cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)
    } finally {
      setChanging(false)
    }
  }

  const unmutePubkey = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
      if (!muteListEvent) return

      const privateTags = await getPrivateTags(muteListEvent)
      const newPrivateTags = privateTags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
      let cipherText = muteListEvent.content
      if (newPrivateTags.length !== privateTags.length) {
        cipherText = await nip04Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      }

      const newMuteListEvent = await publishNewMuteListEvent(
        muteListEvent.tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey),
        cipherText
      )
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)
    } finally {
      setChanging(false)
    }
  }

  const switchToPublicMute = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
      if (!muteListEvent) return

      const privateTags = await getPrivateTags(muteListEvent)
      const newPrivateTags = privateTags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
      if (newPrivateTags.length === privateTags.length) {
        return
      }

      const cipherText = await nip04Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(
        muteListEvent.tags
          .filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
          .concat([['p', pubkey]]),
        cipherText
      )
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)
    } finally {
      setChanging(false)
    }
  }

  const switchToPrivateMute = async (pubkey: string) => {
    if (!accountPubkey || changing) return

    setChanging(true)
    try {
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
      if (!muteListEvent) return

      const newTags = muteListEvent.tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
      if (newTags.length === muteListEvent.tags.length) {
        return
      }

      const privateTags = await getPrivateTags(muteListEvent)
      const newPrivateTags = privateTags
        .filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
        .concat([['p', pubkey]])
      const cipherText = await nip04Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(newTags, cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)
    } finally {
      setChanging(false)
    }
  }

  return (
    <MuteListContext.Provider
      value={{
        mutePubkeys,
        changing,
        getMutePubkeys,
        getMuteType,
        mutePubkeyPublicly,
        mutePubkeyPrivately,
        unmutePubkey,
        switchToPublicMute,
        switchToPrivateMute
      }}
    >
      {children}
    </MuteListContext.Provider>
  )
}
