import dayjs from 'dayjs'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en'
import zh from './zh'
import pl from './pl'

const resources = {
  en,
  zh,
  pl
}

i18n
  .use({
    type: 'languageDetector',
    detect: function () {
      const lng = localStorage.getItem('i18nextLng')
      if (lng === 'pl' || lng === 'zh' || lng === 'en') {
        return lng
      }
      return undefined
    },
    cacheUserLanguage: function (lng: string) {
      if (lng === 'pl' || lng === 'zh' || lng === 'en') {
        localStorage.setItem('i18nextLng', lng)
      }
    }
  })
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    resources,
    interpolation: {
      escapeValue: false // react already safes from xss
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
