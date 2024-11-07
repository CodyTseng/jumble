import { TDraftEvent } from '@common/types'
import { useFetchRelayList } from '@renderer/hooks/useFetchRelayList'
import client from '@renderer/services/client.service'
import { createContext, useContext, useEffect, useState } from 'react'

type TNostrContext = {
  pubkey: string | null
  canLogin: boolean
  login: (nsec: string) => Promise<string>
  logout: () => Promise<void>
  /**
   * Default publish the event to current relays, user's write relays and additional relays
   */
  publish: (draftEvent: TDraftEvent, additionalRelayUrls?: string[]) => Promise<void>
}

const NostrContext = createContext<TNostrContext | undefined>(undefined)

export const useNostr = () => {
  const context = useContext(NostrContext)
  if (!context) {
    throw new Error('useNostr must be used within a NostrProvider')
  }
  return context
}

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const [pubkey, setPubkey] = useState<string | null>(null)
  const [canLogin, setCanLogin] = useState(false)
  const relayList = useFetchRelayList(pubkey)

  useEffect(() => {
    window.api.nostr.getPublicKey().then((pubkey) => {
      if (pubkey) {
        setPubkey(pubkey)
      }
    })
    window.api.system.isEncryptionAvailable().then((isEncryptionAvailable) => {
      setCanLogin(isEncryptionAvailable)
    })
  }, [])

  const login = async (nsec: string) => {
    if (!canLogin) {
      throw new Error('encryption is not available')
    }
    const { pubkey, reason } = await window.api.nostr.login(nsec)
    if (!pubkey) {
      throw new Error(reason ?? 'invalid nsec')
    }
    setPubkey(pubkey)
    return pubkey
  }

  const logout = async () => {
    await window.api.nostr.logout()
    setPubkey(null)
  }

  const publish = async (draftEvent: TDraftEvent, additionalRelayUrls: string[] = []) => {
    const event = await window.api.nostr.signEvent(draftEvent)
    if (!event) {
      throw new Error('sign event failed')
    }
    await client.publishEvent(relayList.write.concat(additionalRelayUrls), event)
  }

  return (
    <NostrContext.Provider value={{ pubkey, canLogin, login, logout, publish }}>
      {children}
    </NostrContext.Provider>
  )
}
