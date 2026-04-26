import { createMuteListDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { getPubkeysFromPTags } from '@/lib/tag'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import dayjs from 'dayjs'
import { Event } from 'nostr-tools'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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
  const publicMutePubkeySet = useMemo(() => new Set(getPubkeysFromPTags(tags)), [tags])
  const privateMutePubkeySet = useMemo(
    () => new Set(getPubkeysFromPTags(privateTags)),
    [privateTags]
  )
  const mutePubkeySet = useMemo(() => {
    return new Set([...Array.from(privateMutePubkeySet), ...Array.from(publicMutePubkeySet)])
  }, [publicMutePubkeySet, privateMutePubkeySet])
  const [changing, setChanging] = useState(false)

  const getPrivateTags = useCallback(
    async (
      muteListEvent: Event
    ): Promise<{ privateTags: string[][]; wasNip04: boolean }> => {
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
        return { privateTags: [], wasNip04: false }
      }
    },
    [nip04Decrypt, nip44Decrypt]
  )

  const migrateToNip44 = useCallback(
    async (muteListEvent: Event, privateTags: string[][]) => {
      if (!accountPubkey) return
      try {
        const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(privateTags))
        const newMuteListDraftEvent = createMuteListDraftEvent(muteListEvent.tags, cipherText)
        const event = await publish(newMuteListDraftEvent)
        await updateMuteListEvent(event, privateTags)
      } catch (error) {
        console.error('[MuteList] Failed to migrate to NIP-44', error)
      }
    },
    [accountPubkey, nip44Encrypt, publish, updateMuteListEvent]
  )

  useEffect(() => {
    const updateMuteTags = async () => {
      if (!muteListEvent) {
        setTags([])
        setPrivateTags([])
        return
      }

      const { privateTags, wasNip04 } = await getPrivateTags(muteListEvent).catch(() => ({
        privateTags: [] as string[][],
        wasNip04: false
      }))
      setPrivateTags(privateTags)
      setTags(muteListEvent.tags)

      if (wasNip04 && privateTags.length > 0) {
        migrateToNip44(muteListEvent, privateTags)
      }
    }
    updateMuteTags()
  }, [muteListEvent])

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

  const publishNewMuteListEvent = async (tags: string[][], content?: string) => {
    if (dayjs().unix() === muteListEvent?.created_at) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
    const newMuteListDraftEvent = createMuteListDraftEvent(tags, content)
    const event = await publish(newMuteListDraftEvent)
    return event
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
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
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
      const cipherText =
        privateTags.length > 0
          ? await nip44Encrypt(accountPubkey, JSON.stringify(privateTags))
          : ''
      const newMuteListEvent = await publishNewMuteListEvent(newTags, cipherText)
      await updateMuteListEvent(newMuteListEvent, privateTags)
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
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
      checkMuteListEvent(muteListEvent)
      const { privateTags } = muteListEvent
        ? await getPrivateTags(muteListEvent)
        : { privateTags: [] as string[][] }
      if (privateTags.some(([tagName, tagValue]) => tagName === 'p' && tagValue === pubkey)) {
        return
      }

      const newPrivateTags = privateTags.concat([['p', pubkey]])
      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(muteListEvent?.tags ?? [], cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)
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
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
      if (!muteListEvent) return

      const { privateTags } = await getPrivateTags(muteListEvent)
      const newPrivateTags = privateTags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
      let cipherText = muteListEvent.content
      if (newPrivateTags.length !== privateTags.length) {
        cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      }

      const newMuteListEvent = await publishNewMuteListEvent(
        muteListEvent.tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey),
        cipherText
      )
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)
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
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
      if (!muteListEvent) return

      const { privateTags } = await getPrivateTags(muteListEvent)
      const newPrivateTags = privateTags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
      if (newPrivateTags.length === privateTags.length) {
        return
      }

      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(
        muteListEvent.tags
          .filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
          .concat([['p', pubkey]]),
        cipherText
      )
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)
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
      const muteListEvent = await client.fetchMuteListEvent(accountPubkey)
      if (!muteListEvent) return

      const newTags = muteListEvent.tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
      if (newTags.length === muteListEvent.tags.length) {
        return
      }

      const { privateTags } = await getPrivateTags(muteListEvent)
      const newPrivateTags = privateTags
        .filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
        .concat([['p', pubkey]])
      const cipherText = await nip44Encrypt(accountPubkey, JSON.stringify(newPrivateTags))
      const newMuteListEvent = await publishNewMuteListEvent(newTags, cipherText)
      await updateMuteListEvent(newMuteListEvent, newPrivateTags)
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
        switchToPrivateMute
      }}
    >
      {children}
    </MuteListContext.Provider>
  )
}
