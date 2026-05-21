import { searchNativeEmojis, TNativeEmoji } from '@/lib/native-emoji-data'
import customEmojiService from '@/services/custom-emoji.service'
import recentEmojiService from '@/services/recent-emoji.service'
import { TEmoji, TSkinTone } from '@/types'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import EmojiGrid, { TEmojiGridSection } from './EmojiGrid'
import EmojiTabs, { TEmojiTabId } from './EmojiTabs'
import PickerSearch from './PickerSearch'
import SkinTonePicker from './SkinTonePicker'
import { useEmojiCollections } from './useEmojiCollections'

export default function EmojiContent({
  onEmojiClick
}: {
  onEmojiClick: (emoji: string | TEmoji) => void
}) {
  const { t } = useTranslation()
  const { nativeCategories, nativeLoading, standalone, packs } = useEmojiCollections()

  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState(false)
  const [activeTabId, setActiveTabId] = useState<TEmojiTabId>('system')
  const [skinTone, setSkinTone] = useState<TSkinTone>(() => recentEmojiService.getSkinTone())
  const [pickVersion, setPickVersion] = useState(0)
  const [nativeResults, setNativeResults] = useState<TNativeEmoji[]>([])
  const [customResults, setCustomResults] = useState<TEmoji[]>([])

  useEffect(() => {
    if (activeTabId === 'system') return
    if (activeTabId === 'standalone') {
      if (standalone.length === 0) setActiveTabId('system')
      return
    }
    if (!packs.find((p) => p.id === activeTabId)) {
      setActiveTabId('system')
    }
  }, [activeTabId, standalone, packs])

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setNativeResults([])
      setCustomResults([])
      return
    }
    let cancelled = false
    Promise.all([searchNativeEmojis(trimmed, 80), customEmojiService.searchEmojis(trimmed)]).then(
      ([n, c]) => {
        if (cancelled) return
        setNativeResults(n)
        setCustomResults(c)
      }
    )
    return () => {
      cancelled = true
    }
  }, [query])

  const handlePick = useCallback(
    (emoji: string | TEmoji) => {
      recentEmojiService.add(emoji)
      setPickVersion((v) => v + 1)
      onEmojiClick(emoji)
    },
    [onEmojiClick]
  )

  const handleSkinToneChange = useCallback((tone: TSkinTone) => {
    recentEmojiService.setSkinTone(tone)
    setSkinTone(tone)
  }, [])

  const sections = useMemo<TEmojiGridSection[]>(() => {
    if (searchMode) {
      if (!query.trim()) {
        return [
          {
            id: 'recent',
            label: t('Recently used'),
            type: 'mixed',
            items: recentEmojiService
              .getRecent(24)
              .filter(
                (item) =>
                  typeof item === 'string' ||
                  customEmojiService.getEmojiById(customEmojiService.getEmojiId(item)) !== undefined
              )
          }
        ].filter((s) => s.items.length > 0) as TEmojiGridSection[]
      }
      const out: TEmojiGridSection[] = []
      if (nativeResults.length > 0) {
        out.push({
          id: 'search-native',
          label: t('Smileys & Emotion'),
          type: 'native',
          items: nativeResults
        })
      }
      if (customResults.length > 0) {
        out.push({
          id: 'search-custom',
          label: t('My emojis'),
          type: 'custom',
          items: customResults
        })
      }
      return out
    }
    if (activeTabId === 'system') {
      const out: TEmojiGridSection[] = []
      const recent = recentEmojiService
        .getRecent(24)
        .filter(
          (item) =>
            typeof item === 'string' ||
            customEmojiService.getEmojiById(customEmojiService.getEmojiId(item)) !== undefined
        )
      if (recent.length > 0) {
        out.push({ id: 'recent', label: t('Recently used'), type: 'mixed', items: recent })
      }
      nativeCategories.forEach((cat) => {
        out.push({ id: cat.id, label: t(cat.labelKey), type: 'native', items: cat.emojis })
      })
      return out
    }
    if (activeTabId === 'standalone') {
      return [
        { id: 'standalone', label: t('My emojis'), type: 'custom', items: standalone }
      ]
    }
    const pack = packs.find((p) => p.id === activeTabId)
    if (pack) {
      return [
        {
          id: pack.id,
          label: pack.title,
          type: 'custom',
          items: pack.emojis
        }
      ]
    }
    return []
  }, [
    searchMode,
    query,
    nativeResults,
    customResults,
    activeTabId,
    nativeCategories,
    standalone,
    packs,
    pickVersion,
    t
  ])

  const showSkinTone = !searchMode && activeTabId === 'system'

  const exitSearch = useCallback(() => {
    setSearchMode(false)
    setQuery('')
  }, [])

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {searchMode ? (
        <div className="flex items-center gap-1 border-b px-1.5 py-1">
          <button
            type="button"
            onClick={exitSearch}
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={t('Back')}
          >
            <ArrowLeft className="size-5 rtl:-scale-x-100" />
          </button>
          <PickerSearch
            value={query}
            onChange={setQuery}
            placeholder={t('Search emojis')}
            autoFocus
          />
        </div>
      ) : (
        <EmojiTabs
          activeTabId={activeTabId}
          onChange={setActiveTabId}
          onSearchClick={() => setSearchMode(true)}
          showStandalone={standalone.length > 0}
          packs={packs}
        />
      )}
      {nativeLoading && sections.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t('Loading...')}
        </div>
      ) : (
        <EmojiGrid sections={sections} skinTone={skinTone} onPick={handlePick} />
      )}
      {showSkinTone && (
        <div className="absolute bottom-1.5 end-1.5 z-10">
          <SkinTonePicker value={skinTone} onChange={handleSkinToneChange} />
        </div>
      )}
    </div>
  )
}
