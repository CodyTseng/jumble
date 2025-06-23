import { useNostr } from '@/providers/NostrProvider'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { TTranslationAccount } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'
import { toast } from 'sonner'

type TJumbleTranslateAccountContext = {
  account: TTranslationAccount | null
  getAccount: () => Promise<void>
  regenerateApiKey: () => Promise<void>
}

export const JumbleTranslateAccountContext = createContext<
  TJumbleTranslateAccountContext | undefined
>(undefined)

export const useJumbleTranslateAccount = () => {
  const context = useContext(JumbleTranslateAccountContext)
  if (!context) {
    throw new Error(
      'useJumbleTranslateAccount must be used within a JumbleTranslateAccountProvider'
    )
  }
  return context
}

export function JumbleTranslateAccountProvider({ children }: { children: React.ReactNode }) {
  const { pubkey } = useNostr()
  const { getAccount: _getAccount, regenerateApiKey: _regenerateApiKey } = useTranslationService()
  const [account, setAccount] = useState<TTranslationAccount | null>(null)

  useEffect(() => {
    setAccount(null)
    if (!pubkey) return

    setTimeout(() => {
      getAccount()
    }, 100)
  }, [pubkey])

  const regenerateApiKey = async (): Promise<void> => {
    try {
      if (!account) {
        await getAccount()
      }
      const newApiKey = await _regenerateApiKey()
      if (newApiKey) {
        setAccount((prev) => {
          if (!prev) return prev
          return {
            ...prev,
            api_key: newApiKey
          }
        })
      }
    } catch (error) {
      toast.error(
        'Failed to regenerate Jumble translation API key: ' +
          (error instanceof Error
            ? error.message
            : 'An error occurred while regenerating the API key')
      )
      setAccount(null)
    }
  }

  const getAccount = async (): Promise<void> => {
    try {
      const data = await _getAccount()
      if (data) {
        setAccount(data)
      }
    } catch (error) {
      toast.error(
        'Failed to fetch Jumble translation account: ' +
          (error instanceof Error ? error.message : 'An error occurred while fetching the account')
      )
      setAccount(null)
    }
  }

  return (
    <JumbleTranslateAccountContext.Provider value={{ account, getAccount, regenerateApiKey }}>
      {children}
    </JumbleTranslateAccountContext.Provider>
  )
}
