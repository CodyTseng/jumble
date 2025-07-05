import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useNostr } from './NostrProvider'

type TUserTrustContext = {
  hideUntrustedInteractions: boolean
  hideUntrustedNotifications: boolean
  hideUntrustedNotes: boolean
  updateHideUntrustedInteractions: (hide: boolean) => void
  updateHideUntrustedNotifications: (hide: boolean) => void
  updateHideUntrustedNotes: (hide: boolean) => void
  isUserTrusted: (pubkey: string) => boolean
}

const UserTrustContext = createContext<TUserTrustContext | undefined>(undefined)

export const useUserTrust = () => {
  const context = useContext(UserTrustContext)
  if (!context) {
    throw new Error('useUserTrust must be used within a UserTrustProvider')
  }
  return context
}

const wotSet = new Set<string>()

export function UserTrustProvider({ children }: { children: React.ReactNode }) {
  const { pubkey: currentPubkey } = useNostr()
  const [hideUntrustedInteractions, setHideUntrustedInteractions] = useState(() =>
    storage.getHideUntrustedInteractions()
  )
  const [hideUntrustedNotifications, setHideUntrustedNotifications] = useState(() =>
    storage.getHideUntrustedNotifications()
  )
  const [hideUntrustedNotes, setHideUntrustedNotes] = useState(() =>
    storage.getHideUntrustedNotes ? storage.getHideUntrustedNotes() : false
  )

  useEffect(() => {
    if (!currentPubkey) return

    const initWoT = async () => {
      const followings = await client.fetchFollowings(currentPubkey)
      await Promise.allSettled(
        followings.map(async (pubkey) => {
          wotSet.add(pubkey)
          const _followings = await client.fetchFollowings(pubkey)
          _followings.forEach((following) => wotSet.add(following))
        })
      )
    }
    initWoT()
  }, [currentPubkey])

  const isUserTrusted = useCallback(
    (pubkey: string) => {
      if (!currentPubkey) return true
      return wotSet.has(pubkey)
    },
    [currentPubkey]
  )

  const updateHideUntrustedInteractions = (hide: boolean) => {
    setHideUntrustedInteractions(hide)
    storage.setHideUntrustedInteractions(hide)
  }

  const updateHideUntrustedNotifications = (hide: boolean) => {
    setHideUntrustedNotifications(hide)
    storage.setHideUntrustedNotifications(hide)
  }

  const updateHideUntrustedNotes = (hide: boolean) => {
    setHideUntrustedNotes(hide)
    if (storage.setHideUntrustedNotes) {
      storage.setHideUntrustedNotes(hide)
    }
  }

  return (
    <UserTrustContext.Provider
      value={{
        hideUntrustedInteractions,
        hideUntrustedNotifications,
        hideUntrustedNotes,
        updateHideUntrustedInteractions,
        updateHideUntrustedNotifications,
        updateHideUntrustedNotes,
        isUserTrusted
      }}
    >
      {children}
    </UserTrustContext.Provider>
  )
}
