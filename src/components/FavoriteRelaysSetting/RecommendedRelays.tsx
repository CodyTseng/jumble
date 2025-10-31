import { Button } from '@/components/ui/button'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import RelayIcon from '../RelayIcon'
import { Languages, Plus } from 'lucide-react'

// Map browser language codes to lang.relays.land relays
const LANGUAGE_RELAY_MAP: Record<string, string> = {
  af: 'wss://lang.relays.land/af',
  ar: 'wss://lang.relays.land/ar',
  az: 'wss://lang.relays.land/az',
  be: 'wss://lang.relays.land/be',
  bg: 'wss://lang.relays.land/bg',
  bn: 'wss://lang.relays.land/bn',
  bs: 'wss://lang.relays.land/bs',
  ca: 'wss://lang.relays.land/ca',
  cs: 'wss://lang.relays.land/cs',
  cy: 'wss://lang.relays.land/cy',
  da: 'wss://lang.relays.land/da',
  de: 'wss://lang.relays.land/de',
  el: 'wss://lang.relays.land/el',
  eo: 'wss://lang.relays.land/eo',
  es: 'wss://lang.relays.land/es',
  et: 'wss://lang.relays.land/et',
  eu: 'wss://lang.relays.land/eu',
  fa: 'wss://lang.relays.land/fa',
  fi: 'wss://lang.relays.land/fi',
  fr: 'wss://lang.relays.land/fr',
  ga: 'wss://lang.relays.land/ga',
  gu: 'wss://lang.relays.land/gu',
  he: 'wss://lang.relays.land/he',
  hi: 'wss://lang.relays.land/hi',
  hr: 'wss://lang.relays.land/hr',
  hu: 'wss://lang.relays.land/hu',
  hy: 'wss://lang.relays.land/hy',
  id: 'wss://lang.relays.land/id',
  is: 'wss://lang.relays.land/is',
  it: 'wss://lang.relays.land/it',
  ja: 'wss://lang.relays.land/ja',
  ka: 'wss://lang.relays.land/ka',
  kk: 'wss://lang.relays.land/kk',
  ko: 'wss://lang.relays.land/ko',
  la: 'wss://lang.relays.land/la',
  lg: 'wss://lang.relays.land/lg',
  lt: 'wss://lang.relays.land/lt',
  lv: 'wss://lang.relays.land/lv',
  mi: 'wss://lang.relays.land/mi',
  mk: 'wss://lang.relays.land/mk',
  mn: 'wss://lang.relays.land/mn',
  mr: 'wss://lang.relays.land/mr',
  ms: 'wss://lang.relays.land/ms',
  nb: 'wss://lang.relays.land/nb',
  nl: 'wss://lang.relays.land/nl',
  nn: 'wss://lang.relays.land/nn',
  pa: 'wss://lang.relays.land/pa',
  pl: 'wss://lang.relays.land/pl',
  pt: 'wss://lang.relays.land/pt',
  ro: 'wss://lang.relays.land/ro',
  ru: 'wss://lang.relays.land/ru',
  sk: 'wss://lang.relays.land/sk',
  sl: 'wss://lang.relays.land/sl',
  sn: 'wss://lang.relays.land/sn',
  so: 'wss://lang.relays.land/so',
  sq: 'wss://lang.relays.land/sq',
  sr: 'wss://lang.relays.land/sr',
  st: 'wss://lang.relays.land/st',
  sv: 'wss://lang.relays.land/sv',
  sw: 'wss://lang.relays.land/sw',
  ta: 'wss://lang.relays.land/ta',
  te: 'wss://lang.relays.land/te',
  th: 'wss://lang.relays.land/th',
  tl: 'wss://lang.relays.land/tl',
  tn: 'wss://lang.relays.land/tn',
  tr: 'wss://lang.relays.land/tr',
  ts: 'wss://lang.relays.land/ts',
  uk: 'wss://lang.relays.land/uk',
  ur: 'wss://lang.relays.land/ur',
  vi: 'wss://lang.relays.land/vi',
  xh: 'wss://lang.relays.land/xh',
  yo: 'wss://lang.relays.land/yo',
  zh: 'wss://lang.relays.land/zh',
  zu: 'wss://lang.relays.land/zu'
}

// Language code to display name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  af: 'Afrikaans',
  ar: 'العربية (Arabic)',
  az: 'Azərbaycanca (Azerbaijani)',
  be: 'Беларуская (Belarusian)',
  bg: 'Български (Bulgarian)',
  bn: 'বাংলা (Bengali)',
  bs: 'Bosanski (Bosnian)',
  ca: 'Català (Catalan)',
  cs: 'Čeština (Czech)',
  cy: 'Cymraeg (Welsh)',
  da: 'Dansk (Danish)',
  de: 'Deutsch (German)',
  el: 'Ελληνικά (Greek)',
  eo: 'Esperanto',
  es: 'Español (Spanish)',
  et: 'Eesti (Estonian)',
  eu: 'Euskara (Basque)',
  fa: 'فارسی (Persian)',
  fi: 'Suomi (Finnish)',
  fr: 'Français (French)',
  ga: 'Gaeilge (Irish)',
  gu: 'ગુજરાતી (Gujarati)',
  he: 'עברית (Hebrew)',
  hi: 'हिन्दी (Hindi)',
  hr: 'Hrvatski (Croatian)',
  hu: 'Magyar (Hungarian)',
  hy: 'Հայերեն (Armenian)',
  id: 'Bahasa Indonesia (Indonesian)',
  is: 'Íslenska (Icelandic)',
  it: 'Italiano (Italian)',
  ja: '日本語 (Japanese)',
  ka: 'ქართული (Georgian)',
  kk: 'Қазақша (Kazakh)',
  ko: '한국어 (Korean)',
  la: 'Latina (Latin)',
  lg: 'Luganda',
  lt: 'Lietuvių (Lithuanian)',
  lv: 'Latviešu (Latvian)',
  mi: 'Te Reo Māori (Māori)',
  mk: 'Македонски (Macedonian)',
  mn: 'Монгол (Mongolian)',
  mr: 'मराठी (Marathi)',
  ms: 'Bahasa Melayu (Malay)',
  nb: 'Norsk Bokmål (Norwegian Bokmål)',
  nl: 'Nederlands (Dutch)',
  nn: 'Norsk Nynorsk (Norwegian Nynorsk)',
  pa: 'ਪੰਜਾਬੀ (Punjabi)',
  pl: 'Polski (Polish)',
  pt: 'Português (Portuguese)',
  ro: 'Română (Romanian)',
  ru: 'Русский (Russian)',
  sk: 'Slovenčina (Slovak)',
  sl: 'Slovenščina (Slovenian)',
  sn: 'chiShona (Shona)',
  so: 'Soomaali (Somali)',
  sq: 'Shqip (Albanian)',
  sr: 'Српски (Serbian)',
  st: 'Sesotho (Southern Sotho)',
  sv: 'Svenska (Swedish)',
  sw: 'Kiswahili (Swahili)',
  ta: 'தமிழ் (Tamil)',
  te: 'తెలుగు (Telugu)',
  th: 'ไทย (Thai)',
  tl: 'Tagalog',
  tn: 'Setswana (Tswana)',
  tr: 'Türkçe (Turkish)',
  ts: 'Xitsonga (Tsonga)',
  uk: 'Українська (Ukrainian)',
  ur: 'اردو (Urdu)',
  vi: 'Tiếng Việt (Vietnamese)',
  xh: 'isiXhosa (Xhosa)',
  yo: 'Yorùbá (Yoruba)',
  zh: '中文 (Chinese)',
  zu: 'isiZulu (Zulu)'
}

function getBrowserLanguages(): string[] {
  const languages: string[] = []
  
  // Get browser languages (navigator.languages returns an array like ['en-US', 'en', 'fr'])
  if (navigator.languages && navigator.languages.length) {
    for (const lang of navigator.languages) {
      // Extract the base language code (e.g., 'en' from 'en-US')
      const baseCode = lang.split('-')[0].toLowerCase()
      if (!languages.includes(baseCode)) {
        languages.push(baseCode)
      }
    }
  } else if (navigator.language) {
    // Fallback for older browsers
    const baseCode = navigator.language.split('-')[0].toLowerCase()
    languages.push(baseCode)
  }
  
  return languages
}

export default function RecommendedRelays() {
  const { t } = useTranslation()
  const { favoriteRelays, addFavoriteRelays } = useFavoriteRelays()
  const [recommendedRelays, setRecommendedRelays] = useState<Array<{ url: string; langCode: string }>>([])

  useEffect(() => {
    const browserLangs = getBrowserLanguages()
    const recommended: Array<{ url: string; langCode: string }> = []
    
    for (const langCode of browserLangs) {
      const relayUrl = LANGUAGE_RELAY_MAP[langCode]
      if (relayUrl && !favoriteRelays.includes(relayUrl)) {
        recommended.push({ url: relayUrl, langCode })
      }
    }
    
    setRecommendedRelays(recommended)
  }, [favoriteRelays])

  const handleAddRelay = async (url: string) => {
    await addFavoriteRelays([url])
  }

  if (recommendedRelays.length === 0) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground font-semibold select-none">
        <Languages className="size-4" />
        <span>{t('Recommended')}</span>
      </div>
      <div className="grid gap-2">
        {recommendedRelays.map(({ url, langCode }) => (
          <div
            key={url}
            className="flex gap-2 border rounded-lg p-2 pr-2.5 items-center justify-between bg-muted/30"
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <RelayIcon url={url} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{url}</div>
                <div className="text-sm text-muted-foreground truncate">
                  {LANGUAGE_NAMES[langCode] || langCode}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleAddRelay(url)}
              className="shrink-0"
            >
              <Plus className="size-4 mr-1" />
              {t('Add')}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
