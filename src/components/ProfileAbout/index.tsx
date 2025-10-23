import {
  EmbeddedHashtagParser,
  EmbeddedMentionParser,
  EmbeddedUrlParser,
  EmbeddedWebsocketUrlParser,
  parseContent
} from '@/lib/content-parser'
import { detectLanguage } from '@/lib/utils'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { EmbeddedHashtag, EmbeddedMention, EmbeddedWebsocketUrl } from '../Embedded'
import ExternalLink from '../ExternalLink'

export default function ProfileAbout({ about, className }: { about?: string; className?: string }) {
  const { t, i18n } = useTranslation()
  const { translateText } = useTranslationService()
  const needTranslation = useMemo(() => {
    const detected = detectLanguage(about)
    if (!detected) return false
    if (detected === 'und') return true
    return !i18n.language.startsWith(detected)
  }, [about, i18n.language])
  const [translatedAbout, setTranslatedAbout] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const aboutNodes = useMemo(() => {
    if (!about) return null

    const nodes = parseContent(translatedAbout ?? about, [
      EmbeddedWebsocketUrlParser,
      EmbeddedUrlParser,
      EmbeddedHashtagParser,
      EmbeddedMentionParser
    ])
    return nodes.map((node, index) => {
      if (node.type === 'url') {
        return <ExternalLink key={index} url={node.data} />
      }
      if (node.type === 'websocket-url') {
        return <EmbeddedWebsocketUrl key={index} url={node.data} />
      }
      if (node.type === 'hashtag') {
        return <EmbeddedHashtag key={index} hashtag={node.data} />
      }
      if (node.type === 'mention') {
        return <EmbeddedMention key={index} userId={node.data.split(':')[1]} />
      }
      return node.data
    })
  }, [about, translatedAbout])

  const handleTranslate = async () => {
    if (translating || translatedAbout) return
    setTranslating(true)
    translateText(about ?? '')
      .then((translated) => {
        setTranslatedAbout(translated)
      })
      .catch((error) => {
        toast.error(
          'Translation failed: ' +
            (error.message || 'An error occurred while translating the about')
        )
      })
      .finally(() => {
        setTranslating(false)
      })
  }

  const handleShowOriginal = () => {
    setTranslatedAbout(null)
  }

  return (
    <div>
      <div className={className}>{aboutNodes}</div>
      {needTranslation && (
        <div className="mt-2 text-sm">
          {translating ? (
            <div className="text-muted-foreground">{t('Translating...')}</div>
          ) : translatedAbout === null ? (
            <button
              className="text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                handleTranslate()
              }}
            >
              {t('Translate')}
            </button>
          ) : (
            <button
              className="text-primary hover:underline"
              onClick={(e) => {
                e.stopPropagation()
                handleShowOriginal()
              }}
            >
              {t('Show original')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
