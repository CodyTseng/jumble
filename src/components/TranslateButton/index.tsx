import {
  EMAIL_REGEX,
  EMBEDDED_EVENT_REGEX,
  EMBEDDED_MENTION_REGEX,
  EMOJI_REGEX,
  HASHTAG_REGEX,
  URL_REGEX,
  WS_URL_REGEX
} from '@/constants'
import { useToast } from '@/hooks'
import { isSupportedKind } from '@/lib/event'
import { cn } from '@/lib/utils'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { franc } from 'franc-min'
import { Languages } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function TranslateButton({
  event,
  setTranslatedEvent
}: {
  event: Event
  setTranslatedEvent: (event: Event | null) => void
}) {
  const { i18n } = useTranslation()
  const { toast } = useToast()
  const { translate } = useTranslationService()
  const [translating, setTranslating] = useState(false)
  const [translated, setTranslated] = useState(false)
  const supported = useMemo(() => isSupportedKind(event.kind), [event])

  const needTranslation = useMemo(() => {
    const cleanText = event.content
      .replace(URL_REGEX, '')
      .replace(WS_URL_REGEX, '')
      .replace(EMAIL_REGEX, '')
      .replace(EMBEDDED_MENTION_REGEX, '')
      .replace(EMBEDDED_EVENT_REGEX, '')
      .replace(HASHTAG_REGEX, '')
      .replace(EMOJI_REGEX, '')
      .trim()

    if (!cleanText) {
      return false
    }

    const hasChinese = /[\u4e00-\u9fff]/.test(cleanText)
    const hasJapanese = /[\u3040-\u309f\u30a0-\u30ff]/.test(cleanText)
    const hasArabic = /[\u0600-\u06ff]/.test(cleanText)
    const hasRussian = /[\u0400-\u04ff]/.test(cleanText)

    if (hasJapanese) return i18n.language !== 'ja'
    if (hasChinese && !hasJapanese) return i18n.language !== 'zh'

    if (hasArabic) return i18n.language !== 'ar'
    if (hasRussian) return i18n.language !== 'ru'

    try {
      const detectedLang = franc(cleanText)
      const langMap: { [key: string]: string } = {
        ara: 'ar', // Arabic
        deu: 'de', // German
        eng: 'en', // English
        spa: 'es', // Spanish
        fra: 'fr', // French
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
        return true
      }

      return !i18n.language.startsWith(normalizedLang)
    } catch {
      return true
    }
  }, [event, i18n.language])

  if (!supported || !needTranslation) {
    return null
  }

  const handleTranslate = async () => {
    if (translating) return

    setTranslating(true)
    await translate(event.content)
      .then(async (translatedText) => {
        if (translatedText) {
          const translatedEvent = { ...event, content: translatedText }
          setTranslatedEvent(translatedEvent)
          setTranslated(true)
        }
      })
      .catch((error) => {
        toast({
          title: 'Translation failed',
          description: error.message || 'An error occurred while translating the note.',
          variant: 'destructive'
        })
      })
      .finally(() => {
        setTranslating(false)
      })
  }

  return (
    <button
      className="flex items-center text-muted-foreground hover:text-foreground pl-3 h-full"
      disabled={translating}
      onClick={(e) => {
        e.stopPropagation()
        if (translated) {
          setTranslatedEvent(null)
          setTranslated(false)
        } else {
          handleTranslate()
        }
      }}
    >
      <Languages
        className={cn(
          'size-4',
          translating
            ? 'text-primary animate-pulse'
            : translated
              ? 'text-primary hover:text-primary/60'
              : ''
        )}
      />
    </button>
  )
}
