import { MAX_PINNED_NOTES } from '@/constants'
import { buildETag, createPinListDraftEvent } from '@/lib/draft-event'
import { getPinnedEventHexIdSetFromPinListEvent } from '@/lib/event-metadata'
import client from '@/services/client.service'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useNostr } from './NostrProvider'

type TPinListContext = {
  pinnedEventHexIdSet: Set<string>
  pin: (event: Event) => Promise<void>
  unpin: (event: Event) => Promise<void>
}

const PinListContext = createContext<TPinListContext | undefined>(undefined)

export const usePinList = () => {
  const context = useContext(PinListContext)
  if (!context) {
    throw new Error('usePinList must be used within a PinListProvider')
  }
  return context
}

export function PinListProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, pinListEvent, publish, updatePinListEvent } = useNostr()
  const pinnedEventHexIdSet = useMemo(
    () => getPinnedEventHexIdSetFromPinListEvent(pinListEvent),
    [pinListEvent]
  )

  const pin = async (event: Event) => {
    if (!accountPubkey) return

    if (event.kind !== kinds.ShortTextNote || event.pubkey !== accountPubkey) return

    const _pin = async () => {
      const pinListEvent = await client.fetchPinListEvent(accountPubkey)
      const currentTags = pinListEvent?.tags || []

      if (currentTags.some((tag) => tag[0] === 'e' && tag[1] === event.id)) {
        return
      }

      let newTags = [...currentTags, buildETag(event.id, event.pubkey)]
      const eTagCount = newTags.filter((tag) => tag[0] === 'e').length
      if (eTagCount > MAX_PINNED_NOTES) {
        let removed = 0
        const needRemove = eTagCount - MAX_PINNED_NOTES
        newTags = newTags.filter((tag) => {
          if (tag[0] === 'e' && removed < needRemove) {
            removed += 1
            return false
          }
          return true
        })
      }

      const newPinListDraftEvent = createPinListDraftEvent(newTags, pinListEvent?.content)
      const newPinListEvent = await publish(newPinListDraftEvent)
      await updatePinListEvent(newPinListEvent)
    }

    const { unwrap } = toast.promise(_pin, {
      loading: t('Pinning...'),
      success: t('Pinned!'),
      error: (err) => t('Failed to pin: {{error}}', { error: err.message })
    })
    await unwrap()
  }

  const unpin = async (event: Event) => {
    if (!accountPubkey) return

    if (event.kind !== kinds.ShortTextNote || event.pubkey !== accountPubkey) return

    const _unpin = async () => {
      const pinListEvent = await client.fetchPinListEvent(accountPubkey)
      if (!pinListEvent) return

      const newTags = pinListEvent.tags.filter((tag) => tag[0] !== 'e' || tag[1] !== event.id)
      if (newTags.length === pinListEvent.tags.length) return

      const newPinListDraftEvent = createPinListDraftEvent(newTags, pinListEvent.content)
      const newPinListEvent = await publish(newPinListDraftEvent)
      await updatePinListEvent(newPinListEvent)
    }

    const { unwrap } = toast.promise(_unpin, {
      loading: t('Unpinning...'),
      success: t('Unpinned!'),
      error: (err) => t('Failed to unpin: {{error}}', { error: err.message })
    })
    await unwrap()
  }

  return (
    <PinListContext.Provider
      value={{
        pinnedEventHexIdSet,
        pin,
        unpin
      }}
    >
      {children}
    </PinListContext.Provider>
  )
}
