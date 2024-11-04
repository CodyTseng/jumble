import { createContext, useContext, useState } from 'react'

type TAccountContext = {
  pubkey: string | null
  login: (nsec: string) => Promise<string | void>
  logout: () => void
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

  const login = async (nsec: string) => {
    // TODO:
    setPubkey(nsec)
  }

  const logout = () => {
    setPubkey(null)
  }

  return (
    <AccountContext.Provider value={{ pubkey, login, logout }}>{children}</AccountContext.Provider>
  )
}
