import dayjs from 'dayjs'
import i18n, { Resource } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar'
import de from './locales/de'
import en from './locales/en'
import es from './locales/es'
import fa from './locales/fa'
import fr from './locales/fr'
import hi from './locales/hi'
import it from './locales/it'
import ja from './locales/ja'
import ko from './locales/ko'
import pl from './locales/pl'
import pt_BR from './locales/pt-BR'
import pt_PT from './locales/pt-PT'
import ru from './locales/ru'
import th from './locales/th'
import zh from './locales/zh'

const languages = {
  ar: { resource: ar, name: 'العربية' },
  de: { resource: de, name: 'Deutsch' },
  en: { resource: en, name: 'English' },
  es: { resource: es, name: 'Español' },
  fa: { resource: fa, name: 'فارسی' },
  fr: { resource: fr, name: 'Français' },
  hi: { resource: hi, name: 'हिन्दी' },
  it: { resource: it, name: 'Italiano' },
  ja: { resource: ja, name: '日本語' },
  ko: { resource: ko, name: '한국어' },
  pl: { resource: pl, name: 'Polski' },
  'pt-BR': { resource: pt_BR, name: 'Português (Brasil)' },
  'pt-PT': { resource: pt_PT, name: 'Português (Portugal)' },
  ru: { resource: ru, name: 'Русский' },
  th: { resource: th, name: 'ไทย' },
  zh: { resource: zh, name: '简体中文' }
} as const

export type TLanguage = keyof typeof languages

// RTL languages list
export const RTL_LANGUAGES: TLanguage[] = ['ar', 'fa']

export const isRTLLanguage = (language: TLanguage): boolean => {
  return RTL_LANGUAGES.includes(language)
}

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
    case 'fa':
      return dayjs(timestamp).format('YYYY/MM/DD')
    case 'it':
    case 'es':
    case 'fr':
    case 'pt-BR':
    case 'pt-PT':
    case 'ar':
    case 'hi':
    case 'th':
      return dayjs(timestamp).format('DD/MM/YYYY')
    case 'ko':
      return dayjs(timestamp).format('YYYY년 MM월 DD일')
    default:
      return dayjs(timestamp).format('MMM D, YYYY')
  }
})

export default i18n
