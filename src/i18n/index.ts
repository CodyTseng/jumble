import dayjs from 'dayjs'
import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import ar from './locales/ar'
import de from './locales/de'
import en from './locales/en'
import es from './locales/es'
import fr from './locales/fr'
import ja from './locales/ja'
import pl from './locales/pl'
import pt from './locales/pt'
import ru from './locales/ru'
import zh from './locales/zh'

export const LocalizedLanguageNames = {
  en: 'English',
  zh: '简体中文',
  pl: 'Polski',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  ru: 'Русский',
  pt: 'Português',
  ar: 'العربية'
}

const resources = {
  en,
  zh,
  pl,
  es,
  fr,
  de,
  ja,
  ru,
  pt,
  ar
}
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
    return dayjs(timestamp).format('YYYY年MM月DD日')
  }
  if (lng?.startsWith('pl')) {
    return dayjs(timestamp).format('DD.MM.YYYY')
  }
  if (lng?.startsWith('ja')) {
    return dayjs(timestamp).format('YYYY年MM月DD日')
  }
  if (lng?.startsWith('de')) {
    return dayjs(timestamp).format('DD.MM.YYYY')
  }
  if (lng?.startsWith('ru')) {
    return dayjs(timestamp).format('DD.MM.YYYY')
  }
  if (lng?.startsWith('es')) {
    return dayjs(timestamp).format('DD/MM/YYYY')
  }
  if (lng?.startsWith('fr')) {
    return dayjs(timestamp).format('DD/MM/YYYY')
  }
  if (lng?.startsWith('pt')) {
    return dayjs(timestamp).format('DD/MM/YYYY')
  }
  if (lng?.startsWith('ar')) {
    return dayjs(timestamp).format('DD/MM/YYYY')
  }
  return dayjs(timestamp).format('MMM D, YYYY')
})

export default i18n
