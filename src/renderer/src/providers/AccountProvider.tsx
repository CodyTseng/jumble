import { createContext, useContext, useEffect, useState } from 'react'

type TAccountContext = {
  pubkey: string | null
  login: (nsec: string) => Promise<string | void>
  logout: () => Promise<void>
}

const AccountContext = createContext<TAccountContext | undefined>(undefined)

export const useAccount = () => {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useAccount must be used within a AccountProvider')
  }
  return context
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [pubkey, setPubkey] = useState<string | null>(null)

  useEffect(() => {
    window.api.nostr.getPublicKey().then((pubkey) => {
      if (pubkey) {
        setPubkey(pubkey)
      }
    })
  }, [])

  const login = async (nsec: string) => {
    const pubkey = await window.api.nostr.login(nsec)
    if (!pubkey) {
      return 'invalid nsec'
    }
    return setPubkey(pubkey)
  }

  const logout = async () => {
    await window.api.nostr.logout()
    setPubkey(null)
  }

  return (
    <AccountContext.Provider value={{ pubkey, login, logout }}>{children}</AccountContext.Provider>
  )
}
