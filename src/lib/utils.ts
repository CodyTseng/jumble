import {
  EMAIL_REGEX,
  EMBEDDED_EVENT_REGEX,
  EMBEDDED_MENTION_REGEX,
  EMOJI_REGEX,
  HASHTAG_REGEX,
  URL_REGEX,
  WS_URL_REGEX
} from '@/constants'
import { TEmoji } from '@/types'
import { clsx, type ClassValue } from 'clsx'
import { parseNativeEmoji } from 'emoji-picker-react/src/dataUtils/parseNativeEmoji'
import { franc } from 'franc-min'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isSafari() {
  if (typeof window === 'undefined' || !window.navigator) return false
  const ua = window.navigator.userAgent
  const vendor = window.navigator.vendor
  return /Safari/.test(ua) && /Apple Computer/.test(vendor) && !/Chrome/.test(ua)
}

export function isAndroid() {
  if (typeof window === 'undefined' || !window.navigator) return false
  const ua = window.navigator.userAgent
  return /android/i.test(ua)
}

export function isTorBrowser() {
  if (typeof window === 'undefined' || !window.navigator) return false
  const ua = window.navigator.userAgent
  return /torbrowser/i.test(ua)
}

export function isTouchDevice() {
  if (typeof window === 'undefined' || !window.navigator) return false
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export function isInViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

export function isPartiallyInViewport(el: HTMLElement) {
  const rect = el.getBoundingClientRect()
  return (
    rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
    rect.bottom > 0 &&
    rect.left < (window.innerWidth || document.documentElement.clientWidth) &&
    rect.right > 0
  )
}

export function isSupportCheckConnectionType() {
  if (typeof window === 'undefined' || !(navigator as any).connection) return false
  return typeof (navigator as any).connection.type === 'string'
}

export function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function isDevEnv() {
  return process.env.NODE_ENV === 'development'
}

export function detectLanguage(text?: string): string | null {
  if (!text) {
    return null
  }
  const cleanText = text
    .replace(URL_REGEX, '')
    .replace(WS_URL_REGEX, '')
    .replace(EMAIL_REGEX, '')
    .replace(EMBEDDED_MENTION_REGEX, '')
    .replace(EMBEDDED_EVENT_REGEX, '')
    .replace(HASHTAG_REGEX, '')
    .replace(EMOJI_REGEX, '')
    .trim()

  if (!cleanText) {
    return null
  }

  if (/[\u3040-\u309f\u30a0-\u30ff]/.test(cleanText)) {
    return 'ja'
  }
  if (/[\u0e00-\u0e7f]/.test(cleanText)) {
    return 'th'
  }
  if (/[\u4e00-\u9fff]/.test(cleanText)) {
    return 'zh'
  }
  if (/[\u0600-\u06ff]/.test(cleanText)) {
    return 'ar'
  }
  if (/[\u0590-\u05FF]/.test(cleanText)) {
    return 'fa'
  }
  if (/[\u0400-\u04ff]/.test(cleanText)) {
    return 'ru'
  }
  if (/[\u0900-\u097f]/.test(cleanText)) {
    return 'hi'
  }

  try {
    const detectedLang = franc(cleanText)
    const langMap: { [key: string]: string } = {
      ara: 'ar', // Arabic
      deu: 'de', // German
      eng: 'en', // English
      spa: 'es', // Spanish
      fas: 'fa', // Persian (Farsi)
      pes: 'fa', // Persian (alternative code)
      fra: 'fr', // French
      hin: 'hi', // Hindi
      hun: 'hu', // Hungarian
      ita: 'it', // Italian
      jpn: 'ja', // Japanese
      pol: 'pl', // Polish
      por: 'pt', // Portuguese
      rus: 'ru', // Russian
      cmn: 'zh', // Chinese (Mandarin)
      zho: 'zh' // Chinese (alternative code)
    }

    const normalizedLang = langMap[detectedLang]
    if (!normalizedLang) {
      return 'und'
    }

    return normalizedLang
  } catch {
    return 'und'
  }
}

export function parseEmojiPickerUnified(unified: string): string | TEmoji | undefined {
  if (unified.startsWith(':')) {
    const secondColonIndex = unified.indexOf(':', 1)
    if (secondColonIndex < 0) return undefined

    const shortcode = unified.slice(1, secondColonIndex)
    const url = unified.slice(secondColonIndex + 1)
    return { shortcode, url }
  } else {
    return parseNativeEmoji(unified)
  }
}
