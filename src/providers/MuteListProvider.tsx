import { createMuteListDraftEvent } from '@/lib/draft-event'
import { extractPubkeysFromEventTags, isSameTag } from '@/lib/tag'
import indexedDb from '@/services/indexed-db.service'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { useNostr } from './NostrProvider'

type TMuteListContext = {
  mutePubkeys: string[]
  mutePubkey: (pubkey: string) => Promise<void>
  unmutePubkey: (pubkey: string) => Promise<void>
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
  const {
    pubkey: accountPubkey,
    muteListEvent,
    publish,
    updateMuteListEvent,
    nip04Decrypt,
    nip04Encrypt
  } = useNostr()
  const [tags, setTags] = useState<string[][]>([])
  const mutePubkeys = useMemo(() => extractPubkeysFromEventTags(tags), [tags])

  useEffect(() => {
    const updateMuteTags = async () => {
      if (!muteListEvent) return

      const tags = [...muteListEvent.tags]
      if (muteListEvent.content) {
        const storedDecryptedTags = await indexedDb.getMuteDecryptedTags(muteListEvent.id)

        if (storedDecryptedTags) {
          tags.push(...storedDecryptedTags)
        } else {
          try {
            const plainText = await nip04Decrypt(muteListEvent.pubkey, muteListEvent.content)
            const contentTags = z.array(z.array(z.string())).parse(JSON.parse(plainText))
            await indexedDb.putMuteDecryptedTags(muteListEvent.id, contentTags)
            tags.push(...contentTags.filter((tag) => tags.every((t) => !isSameTag(t, tag))))
          } catch (error) {
            console.error('Failed to decrypt mute list content', error)
          }
        }
      }
      setTags(tags)
    }
    updateMuteTags()
  }, [muteListEvent])

  const mutePubkey = async (pubkey: string) => {
    if (!accountPubkey) return

    const newTags = tags.concat([['p', pubkey]])
    const cipherText = await nip04Encrypt(accountPubkey, JSON.stringify(newTags))
    const newMuteListDraftEvent = createMuteListDraftEvent(muteListEvent?.tags ?? [], cipherText)
    const newMuteListEvent = await publish(newMuteListDraftEvent)
    await updateMuteListEvent(newMuteListEvent, newTags)
  }

  const unmutePubkey = async (pubkey: string) => {
    if (!accountPubkey || !muteListEvent) return

    const newTags = tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey)
    const cipherText = await nip04Encrypt(accountPubkey, JSON.stringify(newTags))
    const newMuteListDraftEvent = createMuteListDraftEvent(
      muteListEvent.tags.filter((tag) => tag[0] !== 'p' || tag[1] !== pubkey),
      cipherText
    )
    const newMuteListEvent = await publish(newMuteListDraftEvent)
    await updateMuteListEvent(newMuteListEvent, newTags)
  }

  return (
    <MuteListContext.Provider value={{ mutePubkeys, mutePubkey, unmutePubkey }}>
      {children}
    </MuteListContext.Provider>
  )
}
