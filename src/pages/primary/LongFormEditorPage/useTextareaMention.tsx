import MentionList, {
  MentionListHandle
} from '@/components/PostEditor/PostTextarea/Mention/MentionList'
import { pubkeyToNpub } from '@/lib/pubkey'
import { getTextareaCaretRect, scrollTextareaCaretIntoView } from '@/lib/textarea'
import { getTextareaMention, TTextareaMention } from '@/lib/textarea-mention'
import { useFollowList } from '@/providers/FollowListProvider'
import client from '@/services/client.service'
import {
  KeyboardEvent,
  RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import tippy from 'tippy.js'

export default function useTextareaMention({
  textareaRef,
  value,
  onChange,
  enabled
}: {
  textareaRef: RefObject<HTMLTextAreaElement>
  value: string
  onChange: (content: string) => void
  enabled: boolean
}) {
  const { i18n } = useTranslation()
  const { followingSet } = useFollowList()
  const [mention, setMention] = useState<TTextareaMention | null>(null)
  const [results, setResults] = useState<{ query: string; items: string[] }>()
  const [container] = useState(() => document.createElement('div'))
  const listRef = useRef<MentionListHandle>(null)
  const composingRef = useRef(false)
  const direction = i18n.dir()
  const query = mention?.query
  const mentionStart = mention?.from
  const items = results?.query === mention?.query ? (results?.items ?? []) : []
  const open = enabled && !!mention && items.length > 0

  const updateMention = useCallback(() => {
    const textarea = textareaRef.current
    const next =
      enabled && textarea && document.activeElement === textarea && !composingRef.current
        ? getTextareaMention(textarea.value, textarea.selectionStart, textarea.selectionEnd)
        : null
    setMention((current) =>
      current?.from === next?.from && current?.to === next?.to && current?.query === next?.query
        ? current
        : next
    )
  }, [enabled, textareaRef])

  useLayoutEffect(updateMention, [value, updateMention])

  useEffect(() => {
    if (query === undefined) return
    if (!query) {
      setResults({
        query,
        items: Array.from(followingSet)
          .slice(0, 20)
          .map(pubkeyToNpub)
          .filter((npub) => npub !== null)
      })
      return
    }
    let cancelled = false
    client.searchNpubsFromLocal(query, 20).then(
      (items) => {
        if (!cancelled) setResults({ query, items })
      },
      () => {
        if (!cancelled) setResults({ query, items: [] })
      }
    )
    return () => {
      cancelled = true
    }
  }, [query, followingSet])

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || !open || mentionStart === undefined) return
    container.dir = direction
    const popup = tippy(textarea, {
      content: container,
      getReferenceClientRect: () => getTextareaCaretRect(textarea, mentionStart + 1),
      appendTo: () => document.body,
      interactive: true,
      trigger: 'manual',
      placement: direction === 'rtl' ? 'bottom-end' : 'bottom-start',
      offset: [0, 4],
      arrow: false,
      showOnCreate: true,
      onClickOutside: () => setMention(null)
    })
    // Stay at the original @ while the query grows. Re-measure that position
    // when scrolling or when the mobile keyboard changes the viewport.
    const reposition = () => void popup.popperInstance?.update()
    document.addEventListener('scroll', reposition, true)
    window.visualViewport?.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('scroll', reposition)
    return () => {
      popup.destroy()
      document.removeEventListener('scroll', reposition, true)
      window.visualViewport?.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('scroll', reposition)
    }
  }, [open, mentionStart, container, direction, textareaRef])

  const selectMention = ({ id }: { id: string }) => {
    const textarea = textareaRef.current
    if (!textarea || !mention) return
    const current = getTextareaMention(
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd
    )
    if (
      current?.from !== mention.from ||
      current?.to !== mention.to ||
      current?.query !== mention.query
    )
      return
    const insertion = `nostr:${id} `
    onChange(value.slice(0, mention.from) + insertion + value.slice(mention.to))
    setMention(null)
    requestAnimationFrame(() => {
      textarea.focus()
      const cursor = mention.from + insertion.length
      textarea.setSelectionRange(cursor, cursor)
      scrollTextareaCaretIntoView(textarea)
    })
  }

  return {
    onFocus: updateMention,
    onSelect: updateMention,
    onBlur: () => setMention(null),
    onCompositionStart: () => {
      composingRef.current = true
      setMention(null)
    },
    onCompositionEnd: () => {
      composingRef.current = false
      updateMention()
    },
    onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (composingRef.current || event.nativeEvent.isComposing || event.keyCode === 229) return
      if (mention && event.key === 'Escape') {
        event.preventDefault()
        setMention(null)
      } else if (open && listRef.current?.onKeyDown({ event: event.nativeEvent })) {
        event.preventDefault()
      }
    },
    popup: open
      ? createPortal(
          <div onMouseDown={(event) => event.preventDefault()}>
            <MentionList ref={listRef} items={items} command={selectMention} />
          </div>,
          container
        )
      : null
  }
}
