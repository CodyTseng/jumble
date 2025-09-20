import { ExtendedKind } from '@/constants'
import { useTranslatedEvent } from '@/hooks'
import { toTranslation } from '@/lib/link'
import { cn, detectLanguage } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { Languages, Loader } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function TranslateButton({
  event,
  className
}: {
  event: Event
  className?: string
}) {
  const { i18n } = useTranslation()
  const { push } = useSecondaryPage()
  const { translateEvent, showOriginalEvent } = useTranslationService()
  const [translating, setTranslating] = useState(false)
  const translatedEvent = useTranslatedEvent(event.id)
  const supported = useMemo(
    () =>
      [
        kinds.ShortTextNote,
        kinds.Highlights,
        ExtendedKind.COMMENT,
        ExtendedKind.PICTURE,
        ExtendedKind.POLL,
        ExtendedKind.RELAY_REVIEW
      ].includes(event.kind),
    [event]
  )

  const needTranslation = useMemo(() => {
    const detected = detectLanguage(event.content)
    if (!detected) return false
    if (detected === 'und') return true
    return !i18n.language.startsWith(detected)
  }, [event, i18n.language])

  if (!supported || !needTranslation) {
    return null
  }

  const handleTranslate = async () => {
    if (translating) return

    setTranslating(true)
    await translateEvent(event)
      .catch((error) => {
        toast.error(
          'Translation failed: ' + (error.message || 'An error occurred while translating the note')
        )
        if (error.message === 'Insufficient balance.') {
          push(toTranslation())
        }
      })
      .finally(() => {
        setTranslating(false)
      })
  }

  const showOriginal = () => {
    showOriginalEvent(event.id)
  }

  return (
    <button
      className={cn(
        'flex items-center text-muted-foreground hover:text-pink-400 px-2 py-1 h-full disabled:text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0 transition-colors',
        className
      )}
      disabled={translating}
      onClick={(e) => {
        e.stopPropagation()
        if (translatedEvent) {
          showOriginal()
        } else {
          handleTranslate()
        }
      }}
    >
      {translating ? (
        <Loader className="animate-spin" />
      ) : (
        <Languages className={translatedEvent ? 'text-pink-400 hover:text-pink-400/60' : ''} />
      )}
    </button>
  )
}
