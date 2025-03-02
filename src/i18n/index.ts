import dayjs from 'dayjs'
import i18n, { Resource } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

// Import all language files dynamically
const importLanguages = () => {
  const context = import.meta.glob<Record<string, any>>('./locales/*.ts', { eager: true })

  // Skip importing this index file itself
  const resources: Record<string, Resource> = {}

  Object.entries(context).forEach(([path, module]) => {
    // Extract language code from filename (e.g., './locales/en.ts' -> 'en')
    const langCode = path.match(/\.\/locales\/(.+)\.ts$/)?.[1]
    if (langCode) {
      resources[langCode] = module.default || module
    }
  })

  return resources
}

const resources = importLanguages()
const supportedLanguages = Object.keys(resources)

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    resources,
    interpolation: {
      escapeValue: false // react already safes from xss
    },
    detection: {
      convertDetectedLanguage: (lng) => {
        const supported = supportedLanguages.find((supported) => lng.startsWith(supported))
        return supported || 'en'
      }
    }
  })

i18n.services.formatter?.add('date', (timestamp, lng) => {
  if (lng?.startsWith('zh')) {
    return dayjs(timestamp).format('YYYY/MM/DD')
  }
  if (lng?.startsWith('pl')) {
    return dayjs(timestamp).format('DD/MM/YYYY/')
  }
  return dayjs(timestamp).format('MMM D, YYYY')
})

export default i18n
