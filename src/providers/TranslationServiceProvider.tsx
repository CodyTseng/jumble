import { JUMBLE_API_BASE_URL } from '@/constants'
import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNostr } from './NostrProvider'

const translatedTextCache: Record<string, string> = {}

type TTranslationAccount = {
  pubkey: string
  api_key: string
  balance: number
}

type TTranslationServiceContext = {
  account: TTranslationAccount | null
  translate: (text: string) => Promise<string | void>
  getAccount: () => Promise<TTranslationAccount | void>
  regenerateApiKey: () => Promise<void>
}

const TranslationServiceContext = createContext<TTranslationServiceContext | undefined>(undefined)

export const useTranslationService = () => {
  const context = useContext(TranslationServiceContext)
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider')
  }
  return context
}

export function TranslationServiceProvider({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation()
  const { pubkey, signHttpAuth, startLogin } = useNostr()
  const [account, setAccount] = useState<TTranslationAccount | null>(null)

  useEffect(() => {
    setAccount(null)
  }, [pubkey])

  const getAccount = async (): Promise<TTranslationAccount | void> => {
    if (!pubkey) {
      startLogin()
      return
    }
    const url = new URL('/v1/translation/account', JUMBLE_API_BASE_URL).toString()

    let auth: string
    if (account?.api_key) {
      auth = `Bearer ${account.api_key}`
    } else {
      auth = await signHttpAuth(url, 'get')
    }

    const response = await fetch(url, {
      headers: { Authorization: auth }
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to fetch account information')
    }
    setAccount(data)
    return data
  }

  const regenerateApiKey = async (): Promise<void> => {
    let api_key = account?.api_key
    if (!api_key) {
      const act = await getAccount()
      if (!act) return

      api_key = act.api_key
    }
    const url = new URL('/v1/translation/regenerate-api-key', JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api_key}` }
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to regenerate API key')
    }
    if (data.api_key) {
      setAccount((prev) => {
        if (prev) {
          return { ...prev, api_key: data.api_key }
        }
        return prev
      })
    }
  }

  const translate = async (text: string): Promise<string | void> => {
    const target = i18n.language
    const cacheKey = await generateCacheKey(text, target)
    if (translatedTextCache[cacheKey]) {
      return translatedTextCache[cacheKey]
    }

    let api_key = account?.api_key
    if (!api_key) {
      const act = await getAccount()
      if (!act) return

      api_key = act.api_key
    }
    const url = new URL('/v1/translation/translate', JUMBLE_API_BASE_URL).toString()
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${api_key}` },
      body: JSON.stringify({ q: text, target })
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error ?? 'Failed to translate')
    }
    const translatedText = data.translatedText
    translatedTextCache[cacheKey] = translatedText
    return translatedText
  }

  return (
    <TranslationServiceContext.Provider
      value={{ account, getAccount, regenerateApiKey, translate }}
    >
      {children}
    </TranslationServiceContext.Provider>
  )
}

async function generateCacheKey(text: string, target: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(text + '_' + target)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}
