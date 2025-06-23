import libreTranslate from '@/services/libre-translate.service'
import storage from '@/services/local-storage.service'
import translation from '@/services/translation.service'
import { TTranslationAccount, TTranslationServiceConfig } from '@/types'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNostr } from './NostrProvider'

const translatedEventCache: Record<string, Event> = {}

type TTranslationServiceContext = {
  config: TTranslationServiceConfig
  translatedEventIdSet: Set<string>
  translate: (event: Event) => Promise<Event | void>
  getTranslatedEvent: (eventId: string) => Event | null
  showOriginalEvent: (eventId: string) => void
  getAccount: () => Promise<TTranslationAccount | void>
  regenerateApiKey: () => Promise<string | undefined>
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
  const { pubkey, startLogin } = useNostr()
  const [translatedEventIdSet, setTranslatedEventIdSet] = useState<Set<string>>(new Set())

  useEffect(() => {
    translation.changeCurrentPubkey(pubkey)
    const config = storage.getTranslationServiceConfig(pubkey)
    setConfig(config)
  }, [pubkey])

  const getAccount = async (): Promise<TTranslationAccount | void> => {
    if (config.service !== 'jumble') return
    if (!pubkey) {
      startLogin()
      return
    }
    return await translation.getAccount()
  }

  const regenerateApiKey = async (): Promise<string | undefined> => {
    if (config.service !== 'jumble') return
    if (!pubkey) {
      startLogin()
      return
    }
    return await translation.regenerateApiKey()
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

    if (event.kind === kinds.Highlights) {
      const comment = event.tags.find((tag) => tag[0] === 'comment')?.[1]
      const [translatedContent, translatedComment] = await Promise.all([
        config.service === 'jumble'
          ? await translation.translate(event.content, target)
          : await libreTranslate.translate(event.content, target, config.server, config.api_key),
        !!comment &&
          (config.service === 'jumble'
            ? await translation.translate(comment, target)
            : await libreTranslate.translate(comment, target, config.server, config.api_key))
      ])

      if (!translatedContent) {
        return
      }
      const translatedEvent: Event = {
        ...event,
        content: translatedContent
      }
      if (translatedComment) {
        translatedEvent.tags = event.tags.map((tag) =>
          tag[0] === 'comment' ? ['comment', translatedComment] : tag
        )
      }
      translatedEventCache[cacheKey] = translatedEvent
      setTranslatedEventIdSet((prev) => new Set(prev.add(event.id)))
      return translatedEvent
    }

    const translatedText =
      config.service === 'jumble'
        ? await translation.translate(event.content, target)
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
