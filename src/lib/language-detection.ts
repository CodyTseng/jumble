import { franc } from 'franc-min'

// Languages that use RTL (Right-to-Left) text direction
const RTL_LANGUAGE_CODES = new Set([
  'arb', // Arabic
  'pes', // Iranian Persian
  'prs', // Dari
  'urd', // Urdu
  'heb', // Hebrew
  'yid', // Yiddish
  'ara', // Arabic (alternative code)
  'fas', // Farsi/Persian (alternative code)
  'far', // Farsi (alternative code)
])

/**
 * Detects if the given text is in a RTL language
 * @param text - The text to analyze
 * @param minLength - Minimum text length to attempt detection (default: 10)
 * @returns true if the text is likely RTL, false otherwise
 */
export function isTextRTL(text: string, minLength: number = 10): boolean {
  if (!text || text.trim().length < minLength) {
    // For short text, use simple character-based detection
    return hasRTLCharacters(text)
  }

  try {
    // Use franc for language detection on longer text
    const detectedLang = franc(text, { minLength: 3 })

    // If detection is confident, use the result
    if (detectedLang && detectedLang !== 'und') {
      return RTL_LANGUAGE_CODES.has(detectedLang)
    }
  } catch (error) {
    // If franc fails, fall back to character detection
    console.debug('Language detection failed, using character-based detection', error)
  }

  // Fallback to character-based detection
  return hasRTLCharacters(text)
}

/**
 * Checks if text contains RTL characters using Unicode ranges
 * @param text - The text to check
 * @returns true if the text contains significant RTL characters
 */
function hasRTLCharacters(text: string): boolean {
  if (!text) return false

  // RTL Unicode ranges:
  // Arabic: 0600-06FF, 0750-077F, 08A0-08FF, FB50-FDFF, FE70-FEFF
  // Hebrew: 0590-05FF, FB1D-FB4F
  // Persian additions are within Arabic range
  const rtlPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF\uFB1D-\uFB4F]/

  // Count RTL characters
  const rtlMatches = text.match(new RegExp(rtlPattern, 'g'))
  const rtlCount = rtlMatches ? rtlMatches.length : 0

  // Count total non-whitespace characters
  const totalChars = text.replace(/\s/g, '').length

  // If more than 30% are RTL characters, consider it RTL text
  return totalChars > 0 && rtlCount / totalChars > 0.3
}

/**
 * Gets the text direction for the given text
 * @param text - The text to analyze
 * @returns 'rtl' or 'ltr'
 */
export function getTextDirection(text: string): 'rtl' | 'ltr' {
  return isTextRTL(text) ? 'rtl' : 'ltr'
}
