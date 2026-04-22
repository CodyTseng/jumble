import ContentPreviewContent from '@/components/ContentPreview/Content'
import {
  EmbeddedHashtag,
  EmbeddedLNInvoice,
  EmbeddedMention,
  EmbeddedNote,
  EmbeddedWebsocketUrl
} from '@/components/Embedded'
import Emoji from '@/components/Emoji'
import EmojiPicker from '@/components/EmojiPicker'
import ExternalLink from '@/components/ExternalLink'
import ImageGallery from '@/components/ImageGallery'
import MediaPlayer from '@/components/MediaPlayer'
import SuggestedEmojis from '@/components/SuggestedEmojis'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import UserAvatar from '@/components/UserAvatar'
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
import { getEmojiInfosFromEmojiTags } from '@/lib/tag'
import { cn } from '@/lib/utils'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { useNostr } from '@/providers/NostrProvider'
import { usePageActive } from '@/providers/PageActiveProvider'
import cryptoFileService from '@/services/crypto-file.service'
import dmService from '@/services/dm.service'
import { TDmMessage, TEmoji, TImetaInfo } from '@/types'
import dayjs from 'dayjs'
import {
  AlertCircle,
  ArrowDown,
  Check,
  Clock,
  Copy,
  Download,
  Loader2,
  Reply,
  SmilePlus
} from 'lucide-react'
import { kinds } from 'nostr-tools'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  onReply
}: {
  otherPubkey: string
  onReply?: (message: TDmMessage) => void
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { autoLoadProfilePicture } = useContentPolicy()
  const active = usePageActive()
  const [messages, setMessages] = useState<TDmMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [, setStatusVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
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

    // Load more when near the visual top
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    // column-reverse: visual top is at scrollHeight - clientHeight
    const distanceFromVisualTop = Math.min(scrollTop, scrollHeight - clientHeight - scrollTop)
    if (distanceFromVisualTop < 100 && scrollHeight > clientHeight && !isLoadingMore && hasMore) {
      loadMoreMessages()
    }
  }, [loadMoreMessages, isLoadingMore, hasMore, flushPendingMessages, checkIsAtBottom])

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
      const emojiTag = typeof emoji !== 'string' ? ['emoji', emoji.shortcode, emoji.url] : undefined
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
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        className="flex h-full select-text flex-col-reverse overflow-y-auto p-4 [overflow-anchor:none]"
        onScroll={handleScroll}
      >
        <div>
          {isLoadingMore && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
                      <span className="text-xs text-muted-foreground">
                        {formatDmTime(group.timeCreatedAt, t)}
                      </span>
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex gap-2',
                      group.isOwn ? 'flex-row-reverse' : 'flex-row',
                      group.showTime ? 'mt-1' : 'mt-3',
                      lastMsgHasReactions && 'pb-7'
                    )}
                  >
                    {!group.isOwn && autoLoadProfilePicture && (
                      <div className="w-9 shrink-0 self-end">
                        <UserAvatar userId={group.items[0].senderPubkey} size="medium" />
                      </div>
                    )}
                    <div
                      className={cn(
                        'flex min-w-0 flex-1 flex-col gap-0.5 sm:max-w-[80%]',
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
                    {group.isOwn && autoLoadProfilePicture && <div className="w-9 shrink-0" />}
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
            className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary-hover"
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
  const { t } = useTranslation()
  const isFileMessage = message.decryptedRumor?.kind === ExtendedKind.RUMOR_FILE
  const hasBlocks =
    isFileMessage ||
    /https?:\/\/|nostr:n(?:ote|event|addr)1|note1|nevent1|lnbc/i.test(message.content)
  const [copied, setCopied] = useState(false)
  const [isEmojiOpen, setIsEmojiOpen] = useState(false)
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  useEffect(() => {
    setTimeout(() => setIsPickerOpen(false), 100)
  }, [isEmojiOpen])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const longPressTriggeredRef = useRef(false)
  const actionDrawerOpenTimeRef = useRef(0)
  const [isActionDrawerOpen, setIsActionDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<'actions' | 'emoji'>('actions')

  const handleTouchStart = useCallback(() => {
    longPressTriggeredRef.current = false
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true
      actionDrawerOpenTimeRef.current = Date.now()
      setDrawerMode('actions')
      setIsActionDrawerOpen(true)
    }, 500)
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    clearTimeout(longPressTimerRef.current)
    if (longPressTriggeredRef.current) {
      e.preventDefault()
    }
  }, [])

  const handleTouchMove = useCallback(() => {
    clearTimeout(longPressTimerRef.current)
  }, [])

  const handleEmojiSelect = useCallback(
    (emoji: string | TEmoji) => {
      setIsEmojiOpen(false)
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

  const reactButton = (
    <button
      onClick={() => setIsEmojiOpen(true)}
      className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
    >
      <SmilePlus className="h-4 w-4" />
    </button>
  )

  const hasReactions = groupedReactions.length > 0

  return (
    <div
      ref={refCallback}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      className={cn(
        'group/msg flex w-full max-w-full select-none flex-col',
        isOwn ? 'items-end' : 'items-start',
        isElevated && 'relative z-10',
        hasReactions && !isLastInGroup && 'mb-7'
      )}
    >
      {message.replyTo && (
        <button
          onClick={() => onScrollToMessage?.(message.replyTo!.id)}
          className="mb-0.5 flex min-w-0 max-w-full items-center overflow-hidden rounded py-0.5 pl-1.5 pr-2 text-[11px] text-muted-foreground hover:bg-muted"
        >
          <span className="mr-1.5 self-stretch border-l-2 border-muted-foreground/50" />
          {message.replyTo.senderPubkey ? (
            <SimpleUsername
              userId={message.replyTo.senderPubkey}
              className="mr-1 shrink-0 font-medium"
              withoutSkeleton
            />
          ) : null}
          <ContentPreviewContent
            content={message.replyTo.content || '...'}
            className="truncate"
            emojiInfos={getEmojiInfosFromEmojiTags(message.replyTo.tags)}
          />
        </button>
      )}
      <div
        className={cn(
          'flex min-w-0 max-w-full items-end gap-1',
          hasBlocks && !isOwn && 'w-full',
          isFileMessage && 'justify-end',
          isOwn ? 'flex-row' : 'flex-row-reverse'
        )}
      >
        <div
          className={cn(
            'hidden shrink-0 items-center gap-1 px-1 [@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:flex [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/msg:pointer-events-auto [@media(hover:hover)]:group-hover/msg:opacity-100',
            isOwn ? 'flex-row' : 'flex-row-reverse'
          )}
        >
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          {onReact && (
            <Popover open={isEmojiOpen} onOpenChange={setIsEmojiOpen}>
              <PopoverAnchor asChild>{reactButton}</PopoverAnchor>
              <PopoverContent side="top" className="w-fit border-0 p-0 shadow-lg">
                {isPickerOpen ? (
                  <EmojiPicker
                    onEmojiClick={(emoji, e) => {
                      e.stopPropagation()
                      if (!emoji) return
                      handleEmojiSelect(emoji)
                    }}
                  />
                ) : (
                  <SuggestedEmojis
                    onEmojiClick={handleEmojiSelect}
                    onMoreButtonClick={() => setIsPickerOpen(true)}
                  />
                )}
              </PopoverContent>
            </Popover>
          )}
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
            >
              <Reply className="h-4 w-4" />
            </button>
          )}
        </div>
        <Drawer open={isActionDrawerOpen} onOpenChange={setIsActionDrawerOpen}>
          <DrawerContent>
            {drawerMode === 'actions' ? (
              <div className="flex flex-col pb-2">
                {onReply && (
                  <button
                    onClick={() => {
                      if (Date.now() - actionDrawerOpenTimeRef.current < 400) return
                      setIsActionDrawerOpen(false)
                      onReply(message)
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-base active:bg-secondary"
                  >
                    <Reply className="h-5 w-5 text-muted-foreground" />
                    {t('Reply')}
                  </button>
                )}
                {onReact && (
                  <button
                    onClick={() => {
                      if (Date.now() - actionDrawerOpenTimeRef.current < 400) return
                      setDrawerMode('emoji')
                    }}
                    className="flex items-center gap-3 px-4 py-3 text-base active:bg-secondary"
                  >
                    <SmilePlus className="h-5 w-5 text-muted-foreground" />
                    {t('React')}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (Date.now() - actionDrawerOpenTimeRef.current < 400) return
                    handleCopy()
                    setIsActionDrawerOpen(false)
                  }}
                  className="flex items-center gap-3 px-4 py-3 text-base active:bg-secondary"
                >
                  <Copy className="h-5 w-5 text-muted-foreground" />
                  {t('Copy')}
                </button>
              </div>
            ) : (
              <EmojiPicker
                onEmojiClick={(emoji) => {
                  if (!emoji) return
                  handleEmojiSelect(emoji)
                  setIsActionDrawerOpen(false)
                }}
              />
            )}
          </DrawerContent>
        </Drawer>
        {sendingStatus && (
          <div className="pb-1">
            <SendingStatusIcon
              status={sendingStatus}
              onRetry={
                sendingStatus === 'failed' ? () => dmService.resendMessage(message.id) : undefined
              }
            />
          </div>
        )}
        <div className={cn('relative min-w-0 max-w-full', hasBlocks && !isFileMessage && 'flex-1')}>
          {isFileMessage ? (
            <EncryptedFileMessage message={message} isOwn={isOwn} isHighlighted={isHighlighted} />
          ) : (
            <DmContent
              content={message.content}
              isOwn={isOwn}
              bubbleClass={bubbleClass}
              isHighlighted={isHighlighted}
              tags={message.decryptedRumor?.tags}
            />
          )}
          {hasReactions && (
            <div
              className={cn(
                'absolute top-full z-1 mt-0.5 flex flex-wrap gap-1',
                isOwn ? 'left-0' : 'right-0'
              )}
            >
              {groupedReactions.map((r) => (
                <div
                  key={r.emoji}
                  className={cn(
                    'relative flex h-6 cursor-pointer select-none items-center gap-1 overflow-hidden rounded-full border px-1.5 text-sm shadow-xs transition-all duration-200',
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
                        className="h-full bg-linear-to-r from-primary/40 via-primary/60 to-primary/80"
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
                        <img
                          src={r.emojiTag[2]}
                          alt={r.emojiTag[1]}
                          className="inline-block size-4"
                        />
                      ) : (
                        <Emoji
                          emoji={r.emoji}
                          classNames={{ img: 'size-4', text: 'text-sm leading-none' }}
                        />
                      )}
                    </div>
                    {r.count > 1 && (
                      <span className="text-xs text-muted-foreground">{r.count}</span>
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
  tags
}: {
  content: string
  isOwn: boolean
  bubbleClass: string
  isHighlighted?: boolean
  tags?: string[][]
}) {
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

    const allImages = nodes
      .map((node) => {
        if (node.type === 'image') return { url: node.data } as TImetaInfo
        if (node.type === 'images') {
          const urls = Array.isArray(node.data) ? node.data : [node.data]
          return urls.map((url) => ({ url }) as TImetaInfo)
        }
        return null
      })
      .filter(Boolean)
      .flat() as TImetaInfo[]

    const segments = segmentDmContent(nodes)

    // Detect emoji-only content (1-3 emojis, no other content)
    const nonWhitespace = nodes.filter(
      (node) => !(node.type === 'text' && /^\s*$/.test(node.data))
    )
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
  }, [content])

  const emojiInfos = useMemo(() => getEmojiInfosFromEmojiTags(tags), [tags])

  if (segments.length === 0) return null

  let imageIndex = 0

  return (
    <div
      className={cn(
        'flex min-w-0 max-w-full flex-col gap-0.5 rounded-lg transition-all duration-500',
        segments.some((s) => s.kind === 'block') && 'flex-1',
        isOwn ? 'items-end' : 'items-start',
        isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )}
    >
      {segments.map((seg, si) => {
        if (seg.kind === 'text') {
          if (isEmojiOnly) {
            return (
              <div key={si} className="flex items-end gap-1">
                {seg.nodes.map((node, ni) => {
                  if (node.type === 'text')
                    return <span key={ni} className="text-7xl leading-none">{node.data}</span>
                  if (node.type === 'emoji') {
                    const shortcode = node.data.split(':')[1]
                    const emoji = emojiInfos.find((e) => e.shortcode === shortcode)
                    if (!emoji) return node.data
                    return <Emoji classNames={{ img: 'size-20' }} emoji={emoji} key={ni} />
                  }
                  return null
                })}
              </div>
            )
          }
          return (
            <div key={si} className={bubbleClass}>
              <div
                className={cn(
                  'whitespace-pre-wrap text-wrap wrap-break-word text-base',
                  isOwn &&
                    '[&>div]:text-foreground [&_.text-primary]:text-primary-foreground [&_.text-primary]:underline [&_.text-primary]:decoration-primary-foreground/50',
                  '[&_.bg-card:hover]:bg-accent'
                )}
              >
                {seg.nodes.map((node, ni) => {
                  if (node.type === 'text') return node.data
                  if (node.type === 'url') return <ExternalLink url={node.data} key={ni} />
                  if (node.type === 'mention')
                    return <EmbeddedMention key={ni} userId={node.data.split(':')[1]} />
                  if (node.type === 'hashtag')
                    return <EmbeddedHashtag hashtag={node.data} key={ni} />
                  if (node.type === 'websocket-url')
                    return <EmbeddedWebsocketUrl url={node.data} key={ni} />
                  if (node.type === 'emoji') {
                    const shortcode = node.data.split(':')[1]
                    const emoji = emojiInfos.find((e) => e.shortcode === shortcode)
                    if (!emoji) return node.data
                    return <Emoji classNames={{ img: 'mb-1' }} emoji={emoji} key={ni} />
                  }
                  return null
                })}
              </div>
            </div>
          )
        }

        // Block segment
        const { node } = seg
        if (node.type === 'image' || node.type === 'images') {
          const start = imageIndex
          const end = imageIndex + (Array.isArray(node.data) ? node.data.length : 1)
          imageIndex = end
          return <ImageGallery key={si} images={allImages} start={start} end={end} />
        }
        if (node.type === 'media') {
          return <MediaPlayer key={si} src={node.data} />
        }
        if (node.type === 'youtube') {
          return <YoutubeEmbeddedPlayer key={si} url={node.data} />
        }
        if (node.type === 'x-post') {
          return <XEmbeddedPost key={si} url={node.data} />
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

const decryptedBlobCache = new Map<string, string>()

function EncryptedFileMessage({
  message,
  isOwn,
  isHighlighted
}: {
  message: TDmMessage
  isOwn: boolean
  isHighlighted?: boolean
}) {
  const { t } = useTranslation()

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
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(isMedia && !cached)

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

  // Auto-decrypt media files on mount
  useEffect(() => {
    if (!isMedia || decryptedBlobCache.has(message.id)) return
    decryptFile()
  }, [isMedia, message.id, decryptFile])

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
      <div className={wrapperClass}>
        <button
          onClick={handleFileDownload}
          disabled={loading}
          className={cn(
            'flex w-48 items-center gap-2 overflow-hidden rounded-lg p-2 text-left transition-opacity hover:opacity-80',
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
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : error ? (
              <AlertCircle className="h-4 w-4 text-destructive" />
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

  if (loading) {
    const placeholderShape = isImage ? 'h-40 w-40' : 'h-32 w-56'
    return (
      <div className={wrapperClass}>
        <div
          className={cn(
            'flex items-center justify-center overflow-hidden rounded-lg',
            placeholderShape,
            isOwn ? 'bg-primary/20' : 'bg-secondary'
          )}
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !blobUrl) {
    const placeholderShape = isImage ? 'h-40 w-40' : 'h-32 w-56'
    return (
      <div className={wrapperClass}>
        <div
          className={cn(
            'flex items-center justify-center gap-2 overflow-hidden rounded-lg',
            placeholderShape,
            isOwn ? 'bg-primary/20' : 'bg-secondary'
          )}
        >
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-xs text-muted-foreground">{t('Failed to decrypt')}</span>
        </div>
      </div>
    )
  }

  if (isImage) {
    return (
      <div className={wrapperClass}>
        <ImageGallery images={[{ url: blobUrl }]} start={0} end={1} />
      </div>
    )
  }

  if (isVideo) {
    return (
      <div className={wrapperClass}>
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
  switch (status) {
    case 'sending':
      return <Clock className="h-3 w-3 text-muted-foreground" />
    case 'sent':
      return <Check className="h-3 w-3 text-muted-foreground" />
    case 'failed':
      return (
        <button onClick={onRetry} className="flex items-center">
          <AlertCircle className="h-3 w-3 text-destructive" />
        </button>
      )
  }
}
