import { useSecondaryPage } from '@/PageManager'
import { useAllDescendantThreads } from '@/hooks/useThread'
import { getEventKey, getKeyFromTag, getParentTag, isMentioningMutedUsers } from '@/lib/event'
import { toNote } from '@/lib/link'
import { generateBech32IdFromETag } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { NostrEvent } from 'nostr-tools'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReplyNote from '../ReplyNote'

export default function SubReplies({ parentKey }: { parentKey: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const allThreads = useAllDescendantThreads(parentKey)
  const { hideUntrustedInteractions, isUserTrusted } = useUserTrust()
  const { mutePubkeySet } = useMuteList()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const [isExpanded, setIsExpanded] = useState(false)
  const replies = useMemo(() => {
    const replyKeySet = new Set<string>()
    const replyEvents: NostrEvent[] = []

    let parentKeys = [parentKey]
    while (parentKeys.length > 0) {
      const events = parentKeys.flatMap((key) => allThreads.get(key) ?? [])
      events.forEach((evt) => {
        const key = getEventKey(evt)
        if (replyKeySet.has(key)) return
        if (mutePubkeySet.has(evt.pubkey)) return
        if (hideContentMentioningMutedUsers && isMentioningMutedUsers(evt, mutePubkeySet)) return
        if (hideUntrustedInteractions && !isUserTrusted(evt.pubkey)) {
          const replyKey = getEventKey(evt)
          const repliesForThisReply = allThreads.get(replyKey)
          // If the reply is not trusted and there are no trusted replies for this reply, skip rendering
          if (
            !repliesForThisReply ||
            repliesForThisReply.every((evt) => !isUserTrusted(evt.pubkey))
          ) {
            return
          }
        }

        replyKeySet.add(key)
        replyEvents.push(evt)
      })
      parentKeys = events.map((evt) => getEventKey(evt))
    }
    return replyEvents.sort((a, b) => a.created_at - b.created_at)
  }, [
    parentKey,
    allThreads,
    mutePubkeySet,
    hideContentMentioningMutedUsers,
    hideUntrustedInteractions
  ])
  const [highlightReplyKey, setHighlightReplyKey] = useState<string | undefined>(undefined)
  const replyRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const highlightReply = useCallback((key: string, eventId?: string, scrollTo = true) => {
    let found = false
    if (scrollTo) {
      const ref = replyRefs.current[key]
      if (ref) {
        found = true
        ref.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }
    if (!found) {
      if (eventId) push(toNote(eventId))
      return
    }

    setHighlightReplyKey(key)
    setTimeout(() => {
      setHighlightReplyKey((pre) => (pre === key ? undefined : pre))
    }, 1500)
  }, [])

  if (replies.length === 0) return null

  return (
    <div>
      {replies.length > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setIsExpanded(!isExpanded)
          }}
          className="relative w-full flex items-center gap-1.5 pl-14 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors clickable"
        >
          <div
            className={cn('absolute left-[34px] top-0 bottom-0 w-px text-border z-20')}
            style={{
              background: isExpanded
                ? 'currentColor'
                : 'repeating-linear-gradient(to bottom, currentColor 0 3px, transparent 3px 7px)'
            }}
          />
          {isExpanded ? (
            <>
              <ChevronUp className="size-3.5" />
              <span>
                {t('Hide replies')} ({replies.length})
              </span>
            </>
          ) : (
            <>
              <ChevronDown className="size-3.5" />
              <span>
                {t('Show replies')} ({replies.length})
              </span>
            </>
          )}
        </button>
      )}
      {(isExpanded || replies.length === 1) && (
        <div>
          {replies.map((reply, index) => {
            const currentReplyKey = getEventKey(reply)
            const _parentTag = getParentTag(reply)
            if (_parentTag?.type !== 'e') return null
            const _parentKey = _parentTag ? getKeyFromTag(_parentTag.tag) : undefined
            const _parentEventId = generateBech32IdFromETag(_parentTag.tag)
            return (
              <div
                ref={(el) => (replyRefs.current[currentReplyKey] = el)}
                key={currentReplyKey}
                className="scroll-mt-12 flex relative"
              >
                <div className="absolute left-[34px] top-0 h-8 w-4 rounded-bl-lg border-l border-b z-20" />
                {index < replies.length - 1 && (
                  <div className="absolute left-[34px] top-0 bottom-0 border-l z-20" />
                )}
                <ReplyNote
                  className="flex-1 w-0 pl-10"
                  event={reply}
                  parentEventId={_parentKey !== parentKey ? _parentEventId : undefined}
                  onClickParent={() => {
                    if (!_parentKey) return
                    highlightReply(_parentKey, _parentEventId)
                  }}
                  highlight={highlightReplyKey === currentReplyKey}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
