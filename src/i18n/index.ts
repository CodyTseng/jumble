import dayjs from 'dayjs'
import i18n, { Resource } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar'
import de from './locales/de'
import en from './locales/en'
import es from './locales/es'
import fr from './locales/fr'
import it from './locales/it'
import ja from './locales/ja'
import pl from './locales/pl'
import pt_BR from './locales/pt-BR'
import pt_PT from './locales/pt-PT'
import ru from './locales/ru'
import zh from './locales/zh'

const languages = {
  ar: { resource: ar, name: 'العربية' },
  de: { resource: de, name: 'Deutsch' },
  en: { resource: en, name: 'English' },
  es: { resource: es, name: 'Español' },
  fr: { resource: fr, name: 'Français' },
  it: { resource: it, name: 'Italiano' },
  ja: { resource: ja, name: '日本語' },
  pl: { resource: pl, name: 'Polski' },
  'pt-BR': { resource: pt_BR, name: 'Português (Brasil)' },
  'pt-PT': { resource: pt_PT, name: 'Português (Portugal)' },
  ru: { resource: ru, name: 'Русский' },
  zh: { resource: zh, name: '简体中文' }
} as const

export type TLanguage = keyof typeof languages
export const LocalizedLanguageNames: { [key in TLanguage]?: string } = {}
const resources: { [key in TLanguage]?: Resource } = {}
const supportedLanguages: TLanguage[] = []
for (const [key, value] of Object.entries(languages)) {
  const lang = key as TLanguage
  LocalizedLanguageNames[lang] = value.name
  resources[lang] = value.resource
  supportedLanguages.push(lang)
}

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
  switch (lng) {
    case 'zh':
    case 'ja':
      return dayjs(timestamp).format('YYYY年MM月DD日')
    case 'pl':
    case 'de':
    case 'ru':
      return dayjs(timestamp).format('DD.MM.YYYY')
    case 'it':
    case 'es':
    case 'fr':
    case 'pt-BR':
    case 'pt-PT':
    case 'ar':
      return dayjs(timestamp).format('DD/MM/YYYY')
    default:
      return dayjs(timestamp).format('MMM D, YYYY')
  }
})

export default i18n
