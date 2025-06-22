import libreTranslate from '@/services/libre-translate.service'
import storage from '@/services/local-storage.service'
import translation from '@/services/translation.service'
import { TTranslationAccount, TTranslationServiceConfig } from '@/types'
import { Event } from 'nostr-tools'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useNostr } from './NostrProvider'

const translatedEventCache: Record<string, Event> = {}

type TTranslationServiceContext = {
  config: TTranslationServiceConfig
  account: TTranslationAccount | null
  translatedEventIdSet: Set<string>
  translate: (event: Event) => Promise<Event | void>
  getTranslatedEvent: (eventId: string) => Event | null
  showOriginalEvent: (eventId: string) => void
  getAccount: () => Promise<TTranslationAccount | void>
  regenerateApiKey: () => Promise<void>
  updateConfig: (newConfig: TTranslationServiceConfig) => void
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
  const [config, setConfig] = useState<TTranslationServiceConfig>({ service: 'jumble' })
  const { pubkey, signHttpAuth, startLogin } = useNostr()
  const [accountMap, setAccountMap] = useState<Record<string, TTranslationAccount | null>>({})
  const account = useMemo(() => (pubkey ? accountMap[pubkey] : null), [accountMap, pubkey])
  const [translatedEventIdSet, setTranslatedEventIdSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    const config = storage.getTranslationServiceConfig(pubkey)
    setConfig(config)
  }, [pubkey])

  const getAccount = async (): Promise<TTranslationAccount | void> => {
    if (config.service !== 'jumble') return
    if (!pubkey) {
      startLogin()
      return
    }
    const act = await translation.getAccount(signHttpAuth, account?.api_key)
    setAccountMap((prev) => {
      const newMap = { ...prev }
      newMap[pubkey] = act
      return newMap
    })
    return act
  }

  const regenerateApiKey = async (): Promise<void> => {
    if (config.service !== 'jumble') return
    if (!pubkey) {
      startLogin()
      return
    }
    const newApiKey = await translation.regenerateApiKey(signHttpAuth, account?.api_key)
    if (newApiKey) {
      setAccountMap((prev) => {
        const newMap = { ...prev }
        if (newMap[pubkey]) {
          newMap[pubkey] = { ...newMap[pubkey], api_key: newApiKey }
        } else {
          newMap[pubkey] = { pubkey, api_key: newApiKey, balance: 0 }
        }
        return newMap
      })
    }
  }

  const getTranslatedEvent = (eventId: string): Event | null => {
    const target = i18n.language
    const cacheKey = eventId + '_' + target
    return translatedEventCache[cacheKey] ?? null
  }

  const translate = async (event: Event): Promise<Event | void> => {
    if (config.service === 'jumble' && !pubkey) {
      startLogin()
      return
    }

    const target = i18n.language
    const cacheKey = event.id + '_' + target
    if (translatedEventCache[cacheKey]) {
      setTranslatedEventIdSet((prev) => new Set(prev.add(event.id)))
      return translatedEventCache[cacheKey]
    }

    let apiKey = account?.api_key
    if (config.service === 'jumble' && !apiKey) {
      const act = await getAccount()
      if (!act) {
        toast.error('Failed to get translation account. Please try again.')
        return
      }
      apiKey = act.api_key
    }

    const translatedText =
      config.service === 'jumble'
        ? await translation.translate(event.content, target, signHttpAuth, apiKey)
        : await libreTranslate.translate(event.content, target, config.server, config.api_key)
    if (!translatedText) {
      return
    }
    const translatedEvent: Event = { ...event, content: translatedText }
    translatedEventCache[cacheKey] = translatedEvent
    setTranslatedEventIdSet((prev) => new Set(prev.add(event.id)))
    return translatedEvent
  }

  const showOriginalEvent = (eventId: string) => {
    setTranslatedEventIdSet((prev) => {
      const newSet = new Set(prev)
      newSet.delete(eventId)
      return newSet
    })
  }

  const updateConfig = (newConfig: TTranslationServiceConfig) => {
    setConfig(newConfig)
    storage.setTranslationServiceConfig(newConfig, pubkey)
  }

  return (
    <TranslationServiceContext.Provider
      value={{
        config,
        account,
        translatedEventIdSet,
        getAccount,
        regenerateApiKey,
        translate,
        getTranslatedEvent,
        showOriginalEvent,
        updateConfig
      }}
    >
      {children}
    </TranslationServiceContext.Provider>
  )
}
