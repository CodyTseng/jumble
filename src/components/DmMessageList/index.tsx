import ContentPreviewContent from '@/components/ContentPreview/Content'
import {
  EmbeddedHashtag,
  EmbeddedLNInvoice,
  EmbeddedMention,
  EmbeddedNote,
  EmbeddedWebsocketUrl
} from '@/components/Embedded'
import Emoji from '@/components/Emoji'
import ExpressionPicker from '@/components/ExpressionPicker'
import ExternalLink from '@/components/ExternalLink'
import ImageGallery from '@/components/ImageGallery'
import MediaPlayer from '@/components/MediaPlayer'
import MessageContextMenu, { DesktopMessageContextMenu } from './MessageContextMenu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { SimpleUsername } from '@/components/Username'
import XEmbeddedPost from '@/components/XEmbeddedPost'
import YoutubeEmbeddedPlayer from '@/components/YoutubeEmbeddedPlayer'
import { EMOJI_REGEX, ExtendedKind } from '@/constants'
import {
  EmbeddedEmojiParser,
  EmbeddedEventParser,
  EmbeddedHashtagParser,
  EmbeddedLNInvoiceParser,
  EmbeddedMentionParser,
  EmbeddedUrlParser,
  EmbeddedWebsocketUrlParser,
  TEmbeddedNode,
  parseContent
} from '@/lib/content-parser'
import { getEmojiInfosFromEmojiTags, getImetaInfoFromImetaTag } from '@/lib/tag'
import { isImage } from '@/lib/url'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useNostr } from '@/providers/NostrProvider'
import { usePageActive } from '@/providers/PageActiveProvider'
import cryptoFileService from '@/services/crypto-file.service'
import dmService from '@/services/dm.service'
import modalManager from '@/services/modal-manager.service'
import { TDmMessage, TEmoji, TImetaInfo } from '@/types'
import dayjs from 'dayjs'
import {
  AlertCircle,
  ArrowDown,
  Check,
  Clock,
  Download,
  Images,
  Loader2,
  RefreshCw,
  ShieldAlert
} from 'lucide-react'
import { kinds } from 'nostr-tools'
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'

function formatDmTime(timestamp: number, t: ReturnType<typeof useTranslation>['t']): string {
  const msgTime = dayjs.unix(timestamp)
  const now = dayjs()
  const time = msgTime.format('HH:mm')

  if (msgTime.isSame(now, 'day')) {
    return time
  }

  if (msgTime.isSame(now.subtract(1, 'day'), 'day')) {
    return t('dm time yesterday', { yesterday: t('Yesterday'), time })
  }

  if (now.diff(msgTime, 'day') < 7) {
    const weekday = t(`weekday_${msgTime.day()}`)
    return t('dm time weekday', { weekday, time })
  }

  if (msgTime.isSame(now, 'year')) {
    const date = t('{{val, date_short}}', { val: msgTime.toDate() })
    return t('dm time date', { date, time })
  }

  const date = t('{{val, date}}', { val: msgTime.toDate() })
  return t('dm time date', { date, time })
}

export default function DmMessageList({
  otherPubkey,
  onReply,
  scrollToMessageRequest
}: {
  otherPubkey: string
  onReply?: (message: TDmMessage) => void
  scrollToMessageRequest?: { id: string; nonce: number } | null
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const active = usePageActive()
  const [messages, setMessages] = useState<TDmMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [, setStatusVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  // Anchor captured right before prepending older messages, used to keep the
  // viewport visually stable across the prepend (see the useLayoutEffect below).
  const prependAnchorRef = useRef<{ el: HTMLDivElement; top: number } | null>(null)
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [elevatedId, setElevatedId] = useState<string | null>(null)
  const pendingMessagesRef = useRef<TDmMessage[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [reactionsMap, setReactionsMap] = useState<Map<string, TDmMessage[]>>(new Map())

  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current
    const bottom = bottomRef.current
    if (!container || !bottom) return true
    const containerRect = container.getBoundingClientRect()
    const bottomRect = bottom.getBoundingClientRect()
    return bottomRect.top - containerRect.bottom < 100
  }, [])

  // Whether the user has scrolled near the visual top (oldest messages). Uses a
  // sentinel rect instead of raw scrollTop so it works regardless of how the
  // browser signs scrollTop in a column-reverse container. Returns false near
  // the bottom — critical, because the previous Math.min(scrollTop, ...) check
  // also matched at the bottom and spuriously triggered loadMore on the first
  // scroll, yanking the viewport far away when older messages were prepended.
  const checkIsNearTop = useCallback(() => {
    const container = containerRef.current
    const sentinel = topSentinelRef.current
    if (!container || !sentinel) return false
    const containerRect = container.getBoundingClientRect()
    const sentinelRect = sentinel.getBoundingClientRect()
    return sentinelRect.top - containerRect.top > -300
  }, [])

  const scrollToMessage = useCallback((id: string) => {
    const el = messageRefsMap.current.get(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightedId(id)
      setElevatedId(id)
      setTimeout(() => setHighlightedId(null), 1500)
      setTimeout(() => setElevatedId(null), 2000)
    }
  }, [])

  useEffect(() => {
    if (!scrollToMessageRequest) return
    scrollToMessage(scrollToMessageRequest.id)
  }, [scrollToMessageRequest, scrollToMessage])

  const loadMessages = useCallback(async () => {
    if (!pubkey) return

    try {
      const allMsgs = await dmService.getMessages(pubkey, otherPubkey, { limit: 50 })
      // Separate reactions from regular messages
      const reactions: TDmMessage[] = []
      const regularMsgs: TDmMessage[] = []
      for (const msg of allMsgs) {
        if (msg.decryptedRumor?.kind === kinds.Reaction) {
          reactions.push(msg)
        } else {
          regularMsgs.push(msg)
        }
      }
      // Build reactions map
      const newMap = new Map<string, TDmMessage[]>()
      for (const r of reactions) {
        const targetId = r.decryptedRumor?.tags?.find((t: string[]) => t[0] === 'e')?.[1]
        if (targetId) {
          const existing = newMap.get(targetId) ?? []
          existing.push(r)
          newMap.set(targetId, existing)
        }
      }
      setReactionsMap(newMap)
      // Filter out messages that are in the pending buffer (not yet shown to user)
      const pendingIds = new Set(pendingMessagesRef.current.map((m) => m.id))
      setMessages(
        pendingIds.size > 0 ? regularMsgs.filter((m) => !pendingIds.has(m.id)) : regularMsgs
      )
      setHasMore(allMsgs.length >= 50)
    } catch (error) {
      console.error('Failed to load messages:', error)
    } finally {
      setIsLoading(false)
    }
  }, [pubkey, otherPubkey])

  const loadMoreMessages = useCallback(async () => {
    if (!pubkey || isLoadingMore || !hasMore || messages.length === 0) return

    setIsLoadingMore(true)
    try {
      const oldestMessage = messages[0]
      const olderMsgs = await dmService.getMessages(pubkey, otherPubkey, {
        limit: 50,
        before: oldestMessage.createdAt
      })
      if (olderMsgs.length < 50) {
        setHasMore(false)
      }
      // Separate reactions from regular messages
      const reactions: TDmMessage[] = []
      const regularMsgs: TDmMessage[] = []
      for (const msg of olderMsgs) {
        if (msg.decryptedRumor?.kind === kinds.Reaction) {
          reactions.push(msg)
        } else {
          regularMsgs.push(msg)
        }
      }
      if (reactions.length > 0) {
        setReactionsMap((prev) => {
          const updated = new Map(prev)
          for (const r of reactions) {
            const targetId = r.decryptedRumor?.tags?.find((t: string[]) => t[0] === 'e')?.[1]
            if (targetId) {
              const existing = updated.get(targetId) ?? []
              if (!existing.some((e) => e.id === r.id)) {
                existing.push(r)
                updated.set(targetId, existing)
              }
            }
          }
          return updated
        })
      }
      // Capture the current top-of-list anchor so the prepend doesn't shift the
      // viewport. The browser does not preserve scroll position on prepend here
      // ([overflow-anchor:none] in a column-reverse container), so we restore it
      // manually in the useLayoutEffect keyed on `messages`.
      const anchorEl = messageRefsMap.current.get(oldestMessage.id)
      prependAnchorRef.current = anchorEl
        ? { el: anchorEl, top: anchorEl.getBoundingClientRect().top }
        : null
      setMessages((prev) => [...regularMsgs, ...prev])
    } catch (error) {
      console.error('Failed to load more messages:', error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [pubkey, otherPubkey, messages, isLoadingMore, hasMore])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // After older messages are prepended, nudge the scroll position so the anchor
  // message stays visually put. `scrollBy` is direction-consistent across
  // browsers (positive = toward newer), so this is independent of the
  // column-reverse scrollTop sign convention. No-op for appends/flushes, which
  // never set the anchor.
  useLayoutEffect(() => {
    const anchor = prependAnchorRef.current
    if (!anchor) return
    prependAnchorRef.current = null
    const container = containerRef.current
    if (container) {
      container.scrollBy(0, anchor.el.getBoundingClientRect().top - anchor.top)
    }
  }, [messages])

  useEffect(() => {
    if (!pubkey) return

    if (active) {
      dmService.setActiveConversation(pubkey, otherPubkey)
      dmService.markConversationAsRead(pubkey, otherPubkey)
    } else {
      dmService.clearActiveConversation(pubkey, otherPubkey)
    }

    return () => {
      dmService.clearActiveConversation(pubkey, otherPubkey)
    }
  }, [pubkey, otherPubkey, active])

  useEffect(() => {
    if (!pubkey) return

    const participantsKey = dmService.getParticipantsKey(pubkey, otherPubkey)

    const unsubMessage = dmService.onNewMessage((message: TDmMessage) => {
      if (message.participantsKey === participantsKey) {
        const atBottom = checkIsAtBottom()
        const isOwn = message.senderPubkey === pubkey

        if (isOwn || atBottom) {
          // Flush any pending messages + append new one
          const pending = pendingMessagesRef.current
          pendingMessagesRef.current = []
          setPendingCount(0)

          setMessages((prev) => {
            const existing = new Set(prev.map((m) => m.id))
            const newMsgs = [...pending, message].filter((m) => !existing.has(m.id))
            return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
          })
          // Wait for React render + browser layout before scrolling
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
            })
          })
        } else {
          // Buffer the message, don't touch DOM
          if (!pendingMessagesRef.current.some((m) => m.id === message.id)) {
            pendingMessagesRef.current.push(message)
            setPendingCount((c) => c + 1)
          }
        }

        if (dmService.isActiveConversation(pubkey, otherPubkey)) {
          dmService.markConversationAsRead(pubkey, otherPubkey)
        }
      }
    })

    const unsubReaction = dmService.onNewReaction((reaction: TDmMessage) => {
      if (reaction.participantsKey === participantsKey) {
        const targetId = reaction.decryptedRumor?.tags?.find((t: string[]) => t[0] === 'e')?.[1]
        if (targetId) {
          setReactionsMap((prev) => {
            const updated = new Map(prev)
            const existing = updated.get(targetId) ?? []
            if (!existing.some((e) => e.id === reaction.id)) {
              updated.set(targetId, [...existing, reaction])
            }
            return updated
          })
        }
      }
    })

    const unsubData = dmService.onDataChanged(() => {
      loadMessages()
    })

    const unsubStatus = dmService.onSendingStatusChanged(() => {
      setStatusVersion((v) => v + 1)
    })

    return () => {
      unsubMessage()
      unsubReaction()
      unsubData()
      unsubStatus()
    }
  }, [pubkey, otherPubkey, loadMessages, checkIsAtBottom])

  const flushPendingMessages = useCallback(() => {
    if (pendingMessagesRef.current.length === 0) return
    const pending = pendingMessagesRef.current
    pendingMessagesRef.current = []
    setPendingCount(0)
    setMessages((prev) => {
      const existing = new Set(prev.map((m) => m.id))
      const newMsgs = pending.filter((m) => !existing.has(m.id))
      return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev
    })
  }, [])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    if (checkIsAtBottom()) {
      flushPendingMessages()
    }

    // Load more only when near the visual top (oldest messages).
    if (checkIsNearTop() && !isLoadingMore && hasMore) {
      loadMoreMessages()
    }
  }, [
    loadMoreMessages,
    isLoadingMore,
    hasMore,
    flushPendingMessages,
    checkIsAtBottom,
    checkIsNearTop
  ])

  const scrollToBottom = useCallback(() => {
    flushPendingMessages()
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    })
  }, [flushPendingMessages])

  const handleReact = useCallback(
    async (messageId: string, emoji: string | TEmoji) => {
      if (!pubkey) return
      const emojiContent = typeof emoji === 'string' ? emoji : `:${emoji.shortcode}:`
      const emojiTag =
        typeof emoji !== 'string'
          ? emoji.setAddress
            ? ['emoji', emoji.shortcode, emoji.url, emoji.setAddress]
            : ['emoji', emoji.shortcode, emoji.url]
          : undefined
      try {
        await dmService.sendReaction(pubkey, otherPubkey, messageId, emojiContent, emojiTag)
      } catch (error) {
        console.error('Failed to send reaction:', error)
      }
    },
    [pubkey, otherPubkey]
  )

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <p className="text-muted-foreground">{t('No messages yet. Send one!')}</p>
      </div>
    )
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="flex h-full flex-col-reverse overflow-y-auto p-4 select-text [overflow-anchor:none]"
        onScroll={handleScroll}
      >
        <div>
          <div ref={topSentinelRef} />
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          )}
          {(() => {
            const groups: {
              isOwn: boolean
              showTime: boolean
              timeCreatedAt: number
              isFirst: boolean
              items: TDmMessage[]
            }[] = []

            messages.forEach((message, index) => {
              const isOwn = message.senderPubkey === pubkey
              const showTime =
                index === 0 || message.createdAt - messages[index - 1].createdAt > 300
              const isGroupStart =
                index === 0 || messages[index - 1].senderPubkey !== message.senderPubkey || showTime

              if (isGroupStart) {
                groups.push({
                  isOwn,
                  showTime,
                  timeCreatedAt: message.createdAt,
                  isFirst: index === 0,
                  items: []
                })
              }
              groups[groups.length - 1].items.push(message)
            })

            return groups.map((group) => {
              const lastMsgId = group.items[group.items.length - 1].id
              const lastMsgHasReactions = (reactionsMap.get(lastMsgId)?.length ?? 0) > 0
              return (
                <Fragment key={group.items[0].id}>
                  {group.showTime && (
                    <div className={cn('flex justify-center', group.isFirst ? '' : 'mt-3')}>
                      <span className="text-muted-foreground text-xs">
                        {formatDmTime(group.timeCreatedAt, t)}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex',
                      group.isOwn ? 'flex-row-reverse' : 'flex-row',
                      group.showTime ? 'mt-1' : 'mt-3',
                      lastMsgHasReactions && 'pb-7'
                    )}
                  >
                    <div
                      className={cn(
                        'flex max-w-[80%] min-w-0 flex-1 flex-col gap-0.5 sm:max-w-[90%]',
                        group.isOwn ? 'items-end' : 'items-start'
                      )}
                    >
                      {group.items.map((message, mi) => (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          isOwn={group.isOwn}
                          isLastInGroup={mi === group.items.length - 1}
                          sendingStatus={
                            group.isOwn ? dmService.getSendingStatus(message.id) : undefined
                          }
                          onReply={onReply}
                          onReact={handleReact}
                          reactions={reactionsMap.get(message.id)}
                          currentUserPubkey={pubkey ?? undefined}
                          onScrollToMessage={scrollToMessage}
                          isHighlighted={highlightedId === message.id}
                          isElevated={elevatedId === message.id}
                          refCallback={(el) => {
                            if (el) {
                              messageRefsMap.current.set(message.id, el)
                            } else {
                              messageRefsMap.current.delete(message.id)
                            }
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </Fragment>
              )
            })
          })()}
          <div ref={bottomRef} />
        </div>
      </div>
      {pendingCount > 0 && (
        <div className="pointer-events-none absolute bottom-3 flex w-full justify-center">
          <button
            onClick={scrollToBottom}
            className="bg-primary text-primary-foreground hover:bg-primary-hover pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium shadow-lg"
          >
            <ArrowDown className="h-4 w-4" />
            {t('{{n}} new messages', { n: pendingCount > 99 ? '99+' : pendingCount })}
          </button>
        </div>
      )}
    </div>
  )
}

function MessageBubble({
  message,
  isOwn,
  isLastInGroup,
  sendingStatus,
  onReply,
  onReact,
  reactions,
  currentUserPubkey,
  onScrollToMessage,
  isHighlighted,
  isElevated,
  refCallback
}: {
  message: TDmMessage
  isOwn: boolean
  isLastInGroup?: boolean
  sendingStatus?: 'sending' | 'sent' | 'failed'
  onReply?: (message: TDmMessage) => void
  onReact?: (messageId: string, emoji: string | TEmoji) => void
  reactions?: TDmMessage[]
  currentUserPubkey?: string
  onScrollToMessage?: (id: string) => void
  isHighlighted?: boolean
  isElevated?: boolean
  refCallback?: (el: HTMLDivElement | null) => void
}) {
  const isFileMessage = message.decryptedRumor?.kind === ExtendedKind.RUMOR_FILE
  const hasBlocks =
    isFileMessage ||
    /https?:\/\/|nostr:n(?:ote|event|addr)1|note1|nevent1|lnbc/i.test(message.content)
  // When the message is just image URL(s) (e.g. a GIF picked from the picker),
  // the row shouldn't be stretched to full width — otherwise the action buttons
  // float far away from the small image. Cards like EmbeddedNote/YouTube still
  // need the full-width hint, so we only opt out for pure-image messages.
  const isImageOnlyMessage = useMemo(() => {
    if (isFileMessage) return false
    const trimmed = message.content.trim()
    if (!trimmed) return false
    const tokens = trimmed.split(/\s+/)
    return tokens.every((tok) => /^https?:\/\//i.test(tok) && isImage(tok))
  }, [isFileMessage, message.content])
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
  }, [message.content])

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const longPressTriggeredRef = useRef(false)
  const bubbleRef = useRef<HTMLDivElement>(null)
  const contextMenuId = useId()
  const [contextMenuRect, setContextMenuRect] = useState<DOMRect | null>(null)
  const [desktopContextMenuPoint, setDesktopContextMenuPoint] = useState<{
    x: number
    y: number
  } | null>(null)
  const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false)

  const handleTouchStart = useCallback(() => {
    longPressTriggeredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      const rect = bubbleRef.current?.getBoundingClientRect()
      if (rect) setContextMenuRect(rect)
    }, 500)
  }, [])

  // Let the in-app / system back button close the context menu first. Gated on
  // the open state (a post-mount transition) rather than the menu's own mount,
  // so StrictMode's double-invoked mount effect can't spuriously close it via
  // modalManager.unregister (which fires the callback on cleanup).
  useEffect(() => {
    if (!contextMenuRect && !desktopContextMenuPoint) return
    modalManager.register(contextMenuId, () => {
      setContextMenuRect(null)
      setDesktopContextMenuPoint(null)
    })
    return () => modalManager.unregister(contextMenuId)
  }, [contextMenuRect, desktopContextMenuPoint, contextMenuId])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimeout(longPressTimerRef.current)
    if (longPressTriggeredRef.current) {
      e.preventDefault()
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!window.matchMedia('(hover: hover)').matches) return
    e.preventDefault()
    e.stopPropagation()
    setContextMenuRect(null)
    setDesktopContextMenuPoint({ x: e.clientX, y: e.clientY })
  }, [])

  const handleEmojiSelect = useCallback(
    (emoji: string | TEmoji) => {
      onReact?.(message.id, emoji)
    },
    [message.id, onReact]
  )

  // Long-press on reaction chips with progress indicator (same as Likes component)
  const chipLongPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [chipLongPressing, setChipLongPressing] = useState<string | null>(null)
  const [chipCompleted, setChipCompleted] = useState<string | null>(null)

  const handleChipMouseDown = useCallback((emoji: string) => {
    setChipLongPressing(emoji)
    chipLongPressTimerRef.current = setTimeout(() => {
      setChipCompleted(emoji)
      setChipLongPressing(null)
    }, 800)
  }, [])

  const handleChipMouseUp = useCallback(() => {
    if (chipLongPressTimerRef.current) {
      clearTimeout(chipLongPressTimerRef.current)
      chipLongPressTimerRef.current = null
    }
    if (chipCompleted) {
      onReact?.(message.id, chipCompleted)
    }
    setChipLongPressing(null)
    setChipCompleted(null)
  }, [chipCompleted, message.id, onReact])

  const handleChipMouseLeave = useCallback(() => {
    if (chipLongPressTimerRef.current) {
      clearTimeout(chipLongPressTimerRef.current)
      chipLongPressTimerRef.current = null
    }
    setChipLongPressing(null)
    setChipCompleted(null)
  }, [])

  const handleChipTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const isInside =
        touch.clientX >= rect.left &&
        touch.clientX <= rect.right &&
        touch.clientY >= rect.top &&
        touch.clientY <= rect.bottom
      if (!isInside) {
        handleChipMouseLeave()
      }
    },
    [handleChipMouseLeave]
  )

  const bubbleClass = cn(
    'overflow-hidden wrap-break-word rounded-lg px-3 py-1.5',
    'w-fit min-w-9 max-w-full',
    // Smooth out width re-measures (e.g. when a mention resolves from npub to
    // @username). The initial measure goes from `w-fit` (a keyword) to a px
    // value — that transition is discrete and won't animate, so the first set
    // is still instant.
    'transition-[width] duration-200',
    isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary'
  )

  const groupedReactions = useMemo(() => {
    if (!reactions || reactions.length === 0) return []
    const groups = new Map<
      string,
      { emoji: string; count: number; hasOwn: boolean; emojiTag?: string[] }
    >()
    for (const r of reactions) {
      const content = r.content || '+'
      const existing = groups.get(content)
      const isMine = r.senderPubkey === currentUserPubkey
      if (existing) {
        existing.count++
        if (isMine) existing.hasOwn = true
      } else {
        const emojiTag = r.decryptedRumor?.tags?.find((t: string[]) => t[0] === 'emoji')
        groups.set(content, { emoji: content, count: 1, hasOwn: isMine, emojiTag })
      }
    }
    return Array.from(groups.values())
  }, [reactions, currentUserPubkey])

  const hasReactions = groupedReactions.length > 0

  return (
    <div
      ref={refCallback}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onContextMenu={handleContextMenu}
      className={cn(
        'group/msg flex w-full max-w-full flex-col select-none [@media(hover:hover)]:select-text',
        isOwn ? 'items-end' : 'items-start',
        isElevated && 'relative z-10',
        hasReactions && !isLastInGroup && 'mb-7'
      )}
    >
      <div
        className={cn(
          'flex max-w-full min-w-0 items-end gap-1',
          // Stretch to full row so embedded cards (EmbeddedNote / YouTube /
          // X-post) get a width reference and don't collapse to min-content.
          // Both directions need it — keeps own/peer layouts mirrored.
          hasBlocks && !isImageOnlyMessage && 'w-full',
          isFileMessage && 'justify-end',
          isOwn ? 'flex-row' : 'flex-row-reverse'
        )}
      >
        {message.verified === false && (
          <div className="flex shrink-0 items-end pb-1.5">
            <VerificationStatusIcon />
          </div>
        )}
        {/* All send states share one persistent flex slot next to the bubble, so
            the position stays stable while messages update. */}
        {isOwn && sendingStatus && (
          <div className="flex shrink-0 items-end pb-1.5">
            <SendingStatusIcon
              status={sendingStatus}
              onRetry={
                sendingStatus === 'failed' ? () => dmService.resendMessage(message.id) : undefined
              }
            />
          </div>
        )}
        <Drawer open={isActionDrawerOpen} onOpenChange={setIsActionDrawerOpen}>
          <DrawerContent>
            <ExpressionPicker
              onEmojiClick={(emoji) => {
                if (!emoji) return
                handleEmojiSelect(emoji)
                setIsActionDrawerOpen(false)
              }}
            />
          </DrawerContent>
        </Drawer>
        {contextMenuRect && (
          <MessageContextMenu
            originRect={contextMenuRect}
            onReply={() => onReply?.(message)}
            onCopy={handleCopy}
            onReact={handleEmojiSelect}
            onMore={() => {
              setContextMenuRect(null)
              setIsActionDrawerOpen(true)
            }}
            onClose={() => setContextMenuRect(null)}
          >
            {isFileMessage ? (
              <EncryptedFileMessage message={message} isOwn={isOwn} />
            ) : (
              <DmContent
                content={message.content}
                isOwn={isOwn}
                bubbleClass={bubbleClass}
                tags={message.decryptedRumor?.tags}
              />
            )}
          </MessageContextMenu>
        )}
        {desktopContextMenuPoint && (
          <DesktopMessageContextMenu
            anchorPoint={desktopContextMenuPoint}
            onReply={() => onReply?.(message)}
            onCopy={handleCopy}
            onReact={handleEmojiSelect}
            onClose={() => setDesktopContextMenuPoint(null)}
          />
        )}
        <div
          className={cn(
            'relative flex max-w-full min-w-0 flex-col',
            isOwn ? 'items-end' : 'items-start',
            hasBlocks && !isFileMessage && !isImageOnlyMessage && 'flex-1'
          )}
        >
          {message.replyTo && (
            <button
              onClick={() => onScrollToMessage?.(message.replyTo!.id)}
              className="bg-secondary/50 hover:bg-secondary text-muted-foreground mb-0.5 inline-block max-w-full rounded-lg px-2 py-1 align-bottom text-[11px] transition-colors"
            >
              <div className="before:bg-primary relative line-clamp-2 ps-2 text-start before:absolute before:inset-y-0.5 before:start-0 before:w-0.5 before:rounded-full">
                {message.replyTo.senderPubkey && (
                  <SimpleUsername
                    userId={message.replyTo.senderPubkey}
                    className="me-1 inline font-bold after:content-[':']"
                    withoutSkeleton
                  />
                )}
                <ContentPreviewContent
                  content={message.replyTo.content}
                  emojiInfos={getEmojiInfosFromEmojiTags(message.replyTo.tags)}
                />
              </div>
            </button>
          )}
          {isFileMessage ? (
            <EncryptedFileMessage
              message={message}
              isOwn={isOwn}
              isHighlighted={isHighlighted}
              containerRef={bubbleRef}
            />
          ) : (
            <DmContent
              content={message.content}
              isOwn={isOwn}
              bubbleClass={bubbleClass}
              isHighlighted={isHighlighted}
              tags={message.decryptedRumor?.tags}
              containerRef={bubbleRef}
            />
          )}
          {hasReactions && (
            <div
              className={cn(
                // w-max lays the chips out in a single horizontal row (instead
                // of collapsing to the narrow bubble width and stacking
                // vertically); max-w-xs only wraps when there are a lot of them.
                // Anchor on the bubble's inner side so the row grows toward the
                // free space and never overflows past the column edge.
                'absolute top-full z-1 mt-0.5 flex w-max max-w-xs flex-wrap gap-1',
                isOwn ? 'end-0 justify-end' : 'start-0 justify-start'
              )}
            >
              {groupedReactions.map((r) => (
                <div
                  key={r.emoji}
                  className={cn(
                    'relative flex h-6 cursor-pointer items-center gap-1 overflow-hidden rounded-full border px-1.5 text-sm shadow-xs transition-all duration-200 select-none',
                    r.hasOwn
                      ? 'border-primary/50 bg-primary/10 hover:border-primary hover:bg-primary/20'
                      : 'border-border bg-background hover:border-primary/30 hover:bg-primary/5',
                    (chipLongPressing === r.emoji || chipCompleted === r.emoji) &&
                      (r.hasOwn
                        ? 'border-primary bg-primary/20'
                        : 'border-foreground/30 bg-secondary')
                  )}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={() => handleChipMouseDown(r.emoji)}
                  onMouseUp={handleChipMouseUp}
                  onMouseLeave={handleChipMouseLeave}
                  onTouchStart={() => handleChipMouseDown(r.emoji)}
                  onTouchMove={handleChipTouchMove}
                  onTouchEnd={handleChipMouseUp}
                  onTouchCancel={handleChipMouseLeave}
                >
                  {(chipLongPressing === r.emoji || chipCompleted === r.emoji) && (
                    <div className="absolute inset-0 overflow-hidden rounded-full">
                      <div
                        className="from-primary/40 via-primary/60 to-primary/80 h-full bg-linear-to-r"
                        style={{
                          width: chipCompleted === r.emoji ? '100%' : '0%',
                          animation:
                            chipLongPressing === r.emoji
                              ? 'progressFill 1000ms ease-out forwards'
                              : 'none'
                        }}
                      />
                    </div>
                  )}
                  <div className="relative z-10 flex items-center gap-1">
                    <div
                      style={{
                        animation:
                          chipCompleted === r.emoji ? 'shake 0.5s ease-in-out infinite' : undefined
                      }}
                    >
                      {r.emojiTag ? (
                        <Emoji
                          emoji={{ shortcode: r.emojiTag[1], url: r.emojiTag[2] }}
                          classNames={{ img: 'size-4', text: 'text-sm leading-none' }}
                        />
                      ) : (
                        <Emoji
                          emoji={r.emoji}
                          classNames={{ img: 'size-4', text: 'text-sm leading-none' }}
                        />
                      )}
                    </div>
                    {r.count > 1 && (
                      <span className="text-muted-foreground text-xs">{r.count}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type TDmSegment = { kind: 'text'; nodes: TEmbeddedNode[] } | { kind: 'block'; node: TEmbeddedNode }

const BLOCK_TYPES = new Set(['image', 'images', 'media', 'event', 'youtube', 'x-post', 'invoice'])
const HIDDEN_MEDIA_TYPES = new Set(['image', 'images', 'media', 'youtube', 'x-post'])
type TDmHiddenMediaKind = 'image' | 'media'

function isHiddenMediaNode(node: TEmbeddedNode) {
  return HIDDEN_MEDIA_TYPES.has(node.type)
}

function getHiddenMediaKind(node: TEmbeddedNode): TDmHiddenMediaKind {
  return node.type === 'image' || node.type === 'images' ? 'image' : 'media'
}

function segmentDmContent(nodes: TEmbeddedNode[]): TDmSegment[] {
  const segments: TDmSegment[] = []
  let inlineAcc: TEmbeddedNode[] = []

  const flushInline = () => {
    if (inlineAcc.length === 0) return
    // Trim leading whitespace from first text node
    const first = inlineAcc[0]
    if (first.type === 'text' && typeof first.data === 'string') {
      const trimmed = first.data.replace(/^\s+/, '')
      if (trimmed) {
        inlineAcc[0] = { type: 'text', data: trimmed }
      } else {
        inlineAcc = inlineAcc.slice(1)
      }
    }
    // Trim trailing whitespace from last text node
    if (inlineAcc.length > 0) {
      const last = inlineAcc[inlineAcc.length - 1]
      if (last.type === 'text' && typeof last.data === 'string') {
        const trimmed = last.data.replace(/\s+$/, '')
        if (trimmed) {
          inlineAcc[inlineAcc.length - 1] = { type: 'text', data: trimmed }
        } else {
          inlineAcc = inlineAcc.slice(0, -1)
        }
      }
    }
    // Discard whitespace-only segments
    const hasContent = inlineAcc.some(
      (n) => n.type !== 'text' || (typeof n.data === 'string' && n.data.trim() !== '')
    )
    if (hasContent) {
      segments.push({ kind: 'text', nodes: inlineAcc })
    }
    inlineAcc = []
  }

  for (const node of nodes) {
    if (BLOCK_TYPES.has(node.type)) {
      flushInline()
      segments.push({ kind: 'block', node })
    } else {
      inlineAcc.push(node)
    }
  }
  flushInline()

  return segments
}

function DmContent({
  content,
  isOwn,
  bubbleClass,
  isHighlighted,
  tags,
  containerRef
}: {
  content: string
  isOwn: boolean
  bubbleClass: string
  isHighlighted?: boolean
  tags?: string[][]
  containerRef?: React.Ref<HTMLDivElement>
}) {
  const { autoLoadMedia } = useContentPolicy()
  const [mediaRevealed, setMediaRevealed] = useState(false)
  const { allImages, segments, isEmojiOnly } = useMemo(() => {
    if (!content) return { allImages: [], segments: [], isEmojiOnly: false }

    const nodes = parseContent(content, [
      EmbeddedEventParser,
      EmbeddedMentionParser,
      EmbeddedUrlParser,
      EmbeddedLNInvoiceParser,
      EmbeddedWebsocketUrlParser,
      EmbeddedHashtagParser,
      EmbeddedEmojiParser
    ])

    // Index imeta tags by URL so we can attach dim/blurhash/thumbHash to image
    // nodes. Without this the Image placeholder collapses to a tiny rounded
    // border while the GIF loads.
    const imetaByUrl = new Map<string, TImetaInfo>()
    for (const tag of tags ?? []) {
      const imeta = getImetaInfoFromImetaTag(tag)
      if (imeta) imetaByUrl.set(imeta.url, imeta)
    }

    const allImages = nodes
      .map((node) => {
        if (node.type === 'image') {
          return imetaByUrl.get(node.data) ?? ({ url: node.data } as TImetaInfo)
        }
        if (node.type === 'images') {
          const urls = Array.isArray(node.data) ? node.data : [node.data]
          return urls.map((url) => imetaByUrl.get(url) ?? ({ url } as TImetaInfo))
        }
        return null
      })
      .filter(Boolean)
      .flat() as TImetaInfo[]

    const segments = segmentDmContent(nodes)

    // Detect emoji-only content (1-3 emojis, no other content)
    const nonWhitespace = nodes.filter((node) => !(node.type === 'text' && /^\s*$/.test(node.data)))
    let emojiCount = 0
    let emojiOnly = true
    for (const node of nonWhitespace) {
      if (node.type === 'emoji') {
        emojiCount++
      } else if (node.type === 'text') {
        const matches = node.data.match(new RegExp(EMOJI_REGEX.source, 'gu'))
        if (!matches || node.data.replace(new RegExp(EMOJI_REGEX.source, 'gu'), '').trim() !== '') {
          emojiOnly = false
          break
        }
        emojiCount += matches.length
      } else {
        emojiOnly = false
        break
      }
    }
    const isEmojiOnly = emojiOnly && emojiCount > 0 && emojiCount <= 3

    return { allImages, segments, isEmojiOnly }
  }, [content, tags])

  const emojiInfos = useMemo(() => getEmojiInfosFromEmojiTags(tags), [tags])

  if (segments.length === 0) return null

  let imageIndex = 0
  let hiddenMediaBubbleRendered = false
  const mediaHidden = !autoLoadMedia && !mediaRevealed
  const hiddenMediaKind: TDmHiddenMediaKind = (() => {
    const firstHiddenNode = segments.find(
      (seg) => seg.kind === 'block' && isHiddenMediaNode(seg.node)
    )
    if (!firstHiddenNode || firstHiddenNode.kind !== 'block') return 'media'
    return getHiddenMediaKind(firstHiddenNode.node)
  })()

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex max-w-full min-w-0 flex-col gap-0.5 rounded-lg transition-all duration-500',
        // Stretch horizontally so embedded cards (EmbeddedNote / YouTube /
        // X-post) anchor to a stable width even while their content is still
        // loading — otherwise the skeleton collapses to min-content and the
        // card visibly snaps wider once data arrives. flex-1 doesn't help here
        // because the parent is flex-col, where flex grows the cross axis.
        segments.some((s) => s.kind === 'block') && 'w-full',
        isOwn ? 'items-end' : 'items-start',
        isHighlighted && 'ring-primary ring-offset-background ring-2 ring-offset-2'
      )}
    >
      {segments.map((seg, si) => {
        if (seg.kind === 'text') {
          if (isEmojiOnly) {
            return (
              <div key={si} className="flex items-end gap-1">
                {seg.nodes.map((node, ni) => {
                  if (node.type === 'text')
                    return (
                      <span key={ni} className="text-7xl leading-none">
                        {node.data}
                      </span>
                    )
                  if (node.type === 'emoji') {
                    const shortcode = node.data.split(':')[1]
                    const emoji = emojiInfos.find((e) => e.shortcode === shortcode)
                    if (!emoji) return node.data
                    return (
                      <Emoji classNames={{ img: 'size-20' }} emoji={emoji} clickable key={ni} />
                    )
                  }
                  return null
                })}
              </div>
            )
          }
          return (
            <MeasuredTextBubble
              key={si}
              bubbleClass={bubbleClass}
              innerClassName={cn(
                'text-base text-wrap wrap-break-word whitespace-pre-wrap',
                isOwn &&
                  '[&>div]:text-foreground [&_.text-primary]:text-primary-foreground [&_.text-primary]:decoration-primary-foreground/50 [&_.text-primary]:underline',
                '[&_.bg-card:hover]:bg-accent'
              )}
              measureDep={content}
            >
              {seg.nodes.map((node, ni) => {
                if (node.type === 'text') return node.data
                if (node.type === 'url') return <ExternalLink url={node.data} key={ni} />
                if (node.type === 'mention')
                  return <EmbeddedMention key={ni} userId={node.data.split(':')[1]} />
                if (node.type === 'hashtag') return <EmbeddedHashtag hashtag={node.data} key={ni} />
                if (node.type === 'websocket-url')
                  return <EmbeddedWebsocketUrl url={node.data} key={ni} />
                if (node.type === 'emoji') {
                  const shortcode = node.data.split(':')[1]
                  const emoji = emojiInfos.find((e) => e.shortcode === shortcode)
                  if (!emoji) return node.data
                  return <Emoji classNames={{ img: 'mb-1' }} emoji={emoji} clickable key={ni} />
                }
                return null
              })}
            </MeasuredTextBubble>
          )
        }

        // Block segment
        const { node } = seg
        if (mediaHidden && isHiddenMediaNode(node)) {
          if (node.type === 'image' || node.type === 'images') {
            imageIndex += Array.isArray(node.data) ? node.data.length : 1
          }
          if (hiddenMediaBubbleRendered) return null
          hiddenMediaBubbleRendered = true
          return (
            <DmHiddenMediaBubble
              key={si}
              kind={hiddenMediaKind}
              isOwn={isOwn}
              onClick={() => setMediaRevealed(true)}
            />
          )
        }
        if (node.type === 'image' || node.type === 'images') {
          const start = imageIndex
          const end = imageIndex + (Array.isArray(node.data) ? node.data.length : 1)
          imageIndex = end
          return (
            <ImageGallery
              key={si}
              images={allImages}
              start={start}
              end={end}
              mustLoad={mediaRevealed}
            />
          )
        }
        if (node.type === 'media') {
          return <MediaPlayer key={si} src={node.data} mustLoad={mediaRevealed} />
        }
        if (node.type === 'youtube') {
          return <YoutubeEmbeddedPlayer key={si} url={node.data} mustLoad={mediaRevealed} />
        }
        if (node.type === 'x-post') {
          return (
            <XEmbeddedPost key={si} url={node.data} className="w-full" mustLoad={mediaRevealed} />
          )
        }
        if (node.type === 'event') {
          const id = node.data.split(':')[1]
          return <EmbeddedNote key={si} noteId={id} />
        }
        if (node.type === 'invoice') {
          return <EmbeddedLNInvoice key={si} invoice={node.data} />
        }
        return null
      })}
    </div>
  )
}

function DmHiddenMediaBubble({
  kind,
  isOwn,
  onClick
}: {
  kind: TDmHiddenMediaKind
  isOwn: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  const label = kind === 'image' ? t('Click to load image') : t('Click to load media')

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex min-h-14 w-48 max-w-full items-center gap-2 rounded-lg px-3 py-1.5 text-start transition-colors',
        isOwn
          ? 'bg-primary/90 text-primary-foreground hover:bg-primary'
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
      )}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md',
          isOwn ? 'bg-primary-foreground/20' : 'bg-background'
        )}
      >
        <Images className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
      </span>
    </button>
  )
}

// A bubble that shrink-wraps its width to the actual rendered max-line-width,
// not to the unwrapped max-content. CSS alone can't do this when the bubble
// sits inside nested flex columns — `w-fit` reads the unwrapped intrinsic
// size, so the bubble always inflates to max-width even when the wrapped text
// is much narrower. We compute the longest line via Range.getClientRects()
// and set width inline. Re-measures on container resize and on emoji-image
// loads.
function MeasuredTextBubble({
  bubbleClass,
  innerClassName,
  measureDep,
  children
}: {
  bubbleClass: string
  innerClassName: string
  measureDep: unknown
  children: React.ReactNode
}) {
  const bubbleRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const bubble = bubbleRef.current
    const text = textRef.current
    if (!bubble || !text) return

    const measure = () => {
      bubble.style.width = ''

      const range = document.createRange()
      range.selectNodeContents(text)
      const rects = Array.from(range.getClientRects())
      if (rects.length === 0) return

      // Inline-block children (emoji images, mentions) emit their own rects.
      // Group everything by rounded top coord so each visual line is one row.
      const lines = new Map<number, { left: number; right: number }>()
      for (const r of rects) {
        if (r.width === 0 || r.height === 0) continue
        const key = Math.round(r.top)
        const existing = lines.get(key)
        if (existing) {
          existing.left = Math.min(existing.left, r.left)
          existing.right = Math.max(existing.right, r.right)
        } else {
          lines.set(key, { left: r.left, right: r.right })
        }
      }

      let maxLineW = 0
      for (const { left, right } of lines.values()) {
        const w = right - left
        if (w > maxLineW) maxLineW = w
      }
      if (maxLineW <= 0) return

      const cs = getComputedStyle(bubble)
      const padL = parseFloat(cs.paddingLeft) || 0
      const padR = parseFloat(cs.paddingRight) || 0
      bubble.style.width = `${Math.ceil(maxLineW + padL + padR)}px`
    }

    measure()

    let rafId = 0
    const schedule = () => {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(measure)
    }

    // ResizeObserver fires once on observe to deliver the initial size; that
    // fire is redundant with the measure we just did and can cause a 1px
    // re-layout jitter, so we skip it.
    const parent = bubble.parentElement
    let initialObserverFire = true
    const observer = parent
      ? new ResizeObserver(() => {
          if (initialObserverFire) {
            initialObserverFire = false
            return
          }
          schedule()
        })
      : undefined
    if (parent && observer) observer.observe(parent)

    // Mention chips render as @npub1xxx until the user profile resolves, then
    // swap to @username — a real DOM mutation that ResizeObserver can't see.
    // Watch text content/children for changes and re-measure on swap.
    const mutationObserver = new MutationObserver(schedule)
    mutationObserver.observe(text, { childList: true, subtree: true, characterData: true })

    const pendingImgs = Array.from(text.querySelectorAll('img')).filter((img) => !img.complete)
    pendingImgs.forEach((img) => img.addEventListener('load', schedule, { once: true }))

    return () => {
      cancelAnimationFrame(rafId)
      observer?.disconnect()
      mutationObserver.disconnect()
      pendingImgs.forEach((img) => img.removeEventListener('load', schedule))
    }
  }, [measureDep])

  return (
    <div ref={bubbleRef} className={bubbleClass}>
      <div ref={textRef} dir="auto" className={innerClassName}>
        {children}
      </div>
    </div>
  )
}

const decryptedBlobCache = new Map<string, string>()

function EncryptedFileMessage({
  message,
  isOwn,
  isHighlighted,
  containerRef
}: {
  message: TDmMessage
  isOwn: boolean
  isHighlighted?: boolean
  containerRef?: React.Ref<HTMLDivElement>
}) {
  const { t } = useTranslation()
  const { autoLoadMedia } = useContentPolicy()

  const tags = message.decryptedRumor?.tags ?? []
  const fileType = tags.find((t) => t[0] === 'file-type')?.[1] ?? ''
  const hexKey = tags.find((t) => t[0] === 'decryption-key')?.[1]
  const hexNonce = tags.find((t) => t[0] === 'decryption-nonce')?.[1]
  const fileUrl = message.content

  const isImage = fileType.startsWith('image/')
  const isVideo = fileType.startsWith('video/')
  const isAudio = fileType.startsWith('audio/')
  const isMedia = isImage || isVideo || isAudio
  const ext = fileType.split('/')[1]?.split('+')[0] ?? ''

  const cached = decryptedBlobCache.has(message.id)
  const [blobUrl, setBlobUrl] = useState<string | null>(
    cached ? decryptedBlobCache.get(message.id)! : null
  )
  const [mediaRevealed, setMediaRevealed] = useState(false)
  const [error, setError] = useState(false)
  const displayMedia = !isMedia || autoLoadMedia || mediaRevealed
  const [loading, setLoading] = useState(isMedia && displayMedia && !cached)

  const decryptFile = useCallback(async () => {
    if (decryptedBlobCache.has(message.id)) {
      setBlobUrl(decryptedBlobCache.get(message.id)!)
      return decryptedBlobCache.get(message.id)!
    }
    if (!hexKey || !hexNonce || !fileUrl) {
      setError(true)
      return null
    }
    setLoading(true)
    setError(false)
    try {
      const key = cryptoFileService.hexToBytes(hexKey)
      const nonce = cryptoFileService.hexToBytes(hexNonce)
      const response = await fetch(fileUrl)
      if (!response.ok) throw new Error('Failed to fetch file')
      const encryptedData = await response.arrayBuffer()
      const decrypted = await cryptoFileService.decryptFile(encryptedData, key, nonce)
      const blob = new Blob([decrypted], { type: fileType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      decryptedBlobCache.set(message.id, url)
      setBlobUrl(url)
      return url
    } catch (e) {
      console.error('Failed to decrypt file:', e)
      setError(true)
      return null
    } finally {
      setLoading(false)
    }
  }, [message.id, hexKey, hexNonce, fileUrl, fileType])

  useEffect(() => {
    if (!isMedia || !displayMedia || decryptedBlobCache.has(message.id)) return
    decryptFile()
  }, [isMedia, displayMedia, message.id, decryptFile])

  const handleFileDownload = useCallback(async () => {
    if (loading) return
    const url = blobUrl ?? (await decryptFile())
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = ext ? `file.${ext}` : 'file'
    a.click()
  }, [loading, blobUrl, decryptFile, ext])

  const wrapperClass = cn(
    'flex min-w-0 max-w-full flex-col',
    isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg'
  )

  // Non-media files: show card with on-click download
  if (!isMedia) {
    return (
      <div ref={containerRef} className={wrapperClass}>
        <button
          onClick={handleFileDownload}
          disabled={loading}
          className={cn(
            'flex w-48 items-center gap-2 overflow-hidden rounded-lg p-2 text-start transition-opacity hover:opacity-80',
            isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary'
          )}
        >
          <div
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              isOwn ? 'bg-primary-foreground/20' : 'bg-background'
            )}
          >
            {loading ? (
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            ) : error ? (
              <AlertCircle className="text-destructive h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">
              {ext ? ext.toUpperCase() : t('File')}
            </div>
            <div
              className={cn(
                'text-[11px]',
                isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'
              )}
            >
              {loading ? t('Decrypting...') : error ? t('Failed to decrypt') : t('Tap to download')}
            </div>
          </div>
        </button>
      </div>
    )
  }

  if (!displayMedia) {
    return (
      <div ref={containerRef} className={wrapperClass}>
        <DmHiddenMediaBubble
          kind={isImage ? 'image' : 'media'}
          isOwn={isOwn}
          onClick={() => setMediaRevealed(true)}
        />
      </div>
    )
  }

  if (loading || (!blobUrl && !error)) {
    const placeholderShape = isImage ? 'h-40 w-40' : 'h-32 w-56'
    return (
      <div ref={containerRef} className={wrapperClass}>
        <div
          className={cn(
            'flex items-center justify-center overflow-hidden rounded-lg',
            placeholderShape,
            isOwn ? 'bg-primary/20' : 'bg-secondary'
          )}
        >
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      </div>
    )
  }

  if (error || !blobUrl) {
    const placeholderShape = isImage ? 'h-40 w-40' : 'h-32 w-56'
    return (
      <div ref={containerRef} className={wrapperClass}>
        <div
          className={cn(
            'flex items-center justify-center gap-2 overflow-hidden rounded-lg',
            placeholderShape,
            isOwn ? 'bg-primary/20' : 'bg-secondary'
          )}
        >
          <AlertCircle className="text-destructive h-4 w-4" />
          <span className="text-muted-foreground text-xs">{t('Failed to decrypt')}</span>
        </div>
      </div>
    )
  }

  if (isImage) {
    return (
      <div ref={containerRef} className={wrapperClass}>
        <ImageGallery images={[{ url: blobUrl }]} start={0} end={1} mustLoad={displayMedia} />
      </div>
    )
  }

  if (isVideo) {
    return (
      <div ref={containerRef} className={wrapperClass}>
        <div className="overflow-hidden rounded-lg">
          <video src={blobUrl} controls className="max-h-80 max-w-full rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <div
        className={cn(
          'overflow-hidden rounded-lg px-3 py-2',
          isOwn ? 'bg-primary/20' : 'bg-secondary'
        )}
      >
        <audio src={blobUrl} controls className="max-w-full" />
      </div>
    </div>
  )
}

function SendingStatusIcon({
  status,
  onRetry
}: {
  status: 'sending' | 'sent' | 'failed'
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  switch (status) {
    case 'sending':
      return <Clock className="text-muted-foreground h-3 w-3" />
    case 'sent':
      return <Check className="text-muted-foreground h-3 w-3" />
    case 'failed':
      // A bare alert icon read as a passive error badge, not an action. Present
      // the retry as an explicit labelled button (refresh icon + "Resend") so it
      // clearly invites a tap.
      return (
        <button
          onClick={onRetry}
          title={t('Resend')}
          aria-label={t('Resend')}
          className="bg-destructive/10 text-destructive hover:bg-destructive/20 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors"
        >
          <RefreshCw className="h-3 w-3" />
          {t('Resend')}
        </button>
      )
  }
}

function VerificationStatusIcon() {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(true)
        }}
        className="flex items-center"
        aria-label={t('Sender could not be verified')}
        title={t('Sender could not be verified')}
      >
        <ShieldAlert className="h-3 w-3 text-amber-500 dark:text-amber-400" />
      </button>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              {t('Sender could not be verified')}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-start">
                <div>{t('dm verification dialog body')}</div>
                <ul className="ms-4 list-disc space-y-1">
                  <li>{t('dm verification reason rotated')}</li>
                  <li>{t('dm verification reason not found')}</li>
                  <li>{t('dm verification reason impersonated')}</li>
                </ul>
                <div className="text-muted-foreground">{t('dm verification dialog footer')}</div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  )
}
