import { TRelayInfo } from '@/types'

// ISO 639-1 language code to language name mapping
const LANGUAGE_NAMES: Record<string, string> = {
  af: 'Afrikaans',
  ar: 'Arabic',
  az: 'Azerbaijani',
  be: 'Belarusian',
  bg: 'Bulgarian',
  bn: 'Bengali',
  bs: 'Bosnian',
  ca: 'Catalan',
  cs: 'Czech',
  cy: 'Welsh',
  da: 'Danish',
  de: 'German',
  el: 'Greek',
  en: 'English',
  eo: 'Esperanto',
  es: 'Spanish',
  et: 'Estonian',
  eu: 'Basque',
  fa: 'Persian',
  fi: 'Finnish',
  fr: 'French',
  ga: 'Irish',
  gu: 'Gujarati',
  he: 'Hebrew',
  hi: 'Hindi',
  hr: 'Croatian',
  hu: 'Hungarian',
  hy: 'Armenian',
  id: 'Indonesian',
  is: 'Icelandic',
  it: 'Italian',
  ja: 'Japanese',
  ka: 'Georgian',
  kk: 'Kazakh',
  ko: 'Korean',
  la: 'Latin',
  lg: 'Luganda',
  lt: 'Lithuanian',
  lv: 'Latvian',
  mi: 'Maori',
  mk: 'Macedonian',
  mn: 'Mongolian',
  mr: 'Marathi',
  ms: 'Malay',
  nb: 'Norwegian Bokmål',
  nl: 'Dutch',
  nn: 'Norwegian Nynorsk',
  pa: 'Punjabi',
  pl: 'Polish',
  pt: 'Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  sk: 'Slovak',
  sl: 'Slovenian',
  sn: 'Shona',
  so: 'Somali',
  sq: 'Albanian',
  sr: 'Serbian',
  st: 'Southern Sotho',
  sv: 'Swedish',
  sw: 'Swahili',
  ta: 'Tamil',
  te: 'Telugu',
  th: 'Thai',
  tl: 'Tagalog',
  tn: 'Tswana',
  tr: 'Turkish',
  ts: 'Tsonga',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
  xh: 'Xhosa',
  yo: 'Yoruba',
  zh: 'Chinese',
  zu: 'Zulu',
}

export function checkAlgoRelay(relayInfo: TRelayInfo | undefined) {
  return relayInfo?.software === 'https://github.com/bitvora/algo-relay' // hardcode for now
}

export function checkSearchRelay(relayInfo: TRelayInfo | undefined) {
  return relayInfo?.supported_nips?.includes(50)
}

/**
 * Get a friendly display name for a relay, with special handling for language relays
 */
export function getRelayDisplayName(relayInfo: TRelayInfo | undefined): string {
  if (!relayInfo) {
    return ''
  }

  // Check if this is a language relay (lang.relays.land/XX format)
  const langMatch = relayInfo.url.match(/lang\.relays\.land\/([a-z]{2})$/i)
  if (langMatch) {
    const langCode = langMatch[1].toLowerCase()
    const languageName = LANGUAGE_NAMES[langCode]
    if (languageName) {
      return languageName
    }
  }

  // For other relays, use name if available, otherwise shortUrl
  return relayInfo.name || relayInfo.shortUrl
}
