import { useSecondaryPage } from '@/PageManager'
import { useFilteredAllReplies } from '@/hooks'
import { getEventKey, getKeyFromTag, getParentTag } from '@/lib/event'
import { toNote } from '@/lib/link'
import { generateBech32IdFromETag } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReplyNote from '../ReplyNote'

export default function SubReplies({ parentKey }: { parentKey: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { autoLoadProfilePicture } = useContentPolicy()
  const [isExpanded, setIsExpanded] = useState(false)
  const { replies } = useFilteredAllReplies(parentKey)
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
          className={cn(
            'clickable relative flex w-full items-center gap-1.5 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground',
            autoLoadProfilePicture ? 'ps-14' : 'ps-5'
          )}
        >
          <div
            className={cn(
              'absolute bottom-0 top-0 z-20 w-px text-border',
              autoLoadProfilePicture ? 'start-[34px]' : 'start-2'
            )}
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
                className="relative flex scroll-mt-12"
              >
                <div
                  className={cn(
                    'absolute top-0 z-20 rounded-es-lg border-b border-s',
                    autoLoadProfilePicture ? 'h-8' : 'h-6',
                    autoLoadProfilePicture ? 'start-[34px] w-4' : 'start-2 w-7'
                  )}
                />
                {index < replies.length - 1 && (
                  <div
                    className={cn(
                      'absolute bottom-0 z-20 border-s',
                      autoLoadProfilePicture ? 'start-[34px]' : 'start-2', 'top-0'
                    )}
                  />
                )}
                <ReplyNote
                  className={cn('w-0 flex-1', autoLoadProfilePicture ? 'ps-10' : 'ps-7')}
                  hideThreadGuide={!autoLoadProfilePicture}
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
