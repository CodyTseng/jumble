import Content from '@/components/Content'
import ContentPreviewContent from '@/components/ContentPreview/Content'
import UserAvatar from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { usePageActive } from '@/providers/PageActiveProvider'
import dmService from '@/services/dm.service'
import { TDmMessage } from '@/types'
import dayjs from 'dayjs'
import { AlertCircle, ArrowDown, Check, Clock, Copy, Loader2, Reply } from 'lucide-react'
import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function DmMessageList({
  otherPubkey,
  onReply
}: {
  otherPubkey: string
  onReply?: (message: TDmMessage) => void
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
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [elevatedId, setElevatedId] = useState<string | null>(null)
  const pendingMessagesRef = useRef<TDmMessage[]>([])
  const [pendingCount, setPendingCount] = useState(0)

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
      const msgs = await dmService.getMessages(pubkey, otherPubkey, { limit: 50 })
      // Filter out messages that are in the pending buffer (not yet shown to user)
      const pendingIds = new Set(pendingMessagesRef.current.map((m) => m.id))
      setMessages(pendingIds.size > 0 ? msgs.filter((m) => !pendingIds.has(m.id)) : msgs)
      setHasMore(msgs.length >= 50)
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
      setMessages((prev) => [...olderMsgs, ...prev])
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

    const conversationKey = dmService.getConversationKey(pubkey, otherPubkey)

    const unsubMessage = dmService.onNewMessage((message: TDmMessage) => {
      if (message.conversationKey === conversationKey) {
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

    const unsubData = dmService.onDataChanged(() => {
      loadMessages()
    })

    const unsubStatus = dmService.onSendingStatusChanged(() => {
      setStatusVersion((v) => v + 1)
    })

    return () => {
      unsubMessage()
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
    const distanceFromVisualTop = Math.min(
      scrollTop,
      scrollHeight - clientHeight - scrollTop
    )
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
        className="flex h-full flex-col-reverse select-text overflow-y-auto p-4 [overflow-anchor:none]"
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
          const showTime = index === 0 || message.createdAt - messages[index - 1].createdAt > 300
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

        return groups.map((group) => (
          <Fragment key={group.items[0].id}>
            {group.showTime && (
              <div className={cn('flex justify-center', group.isFirst ? '' : 'mt-3')}>
                <span className="text-xs text-muted-foreground">
                  {dayjs.unix(group.timeCreatedAt).format('HH:mm')}
                </span>
              </div>
            )}
            <div
              className={cn(
                'flex gap-2',
                group.isOwn ? 'flex-row-reverse' : 'flex-row',
                group.showTime ? 'mt-1' : 'mt-3'
              )}
            >
              {!group.isOwn && (
                <div className="w-9 shrink-0 self-end">
                  <UserAvatar userId={group.items[0].senderPubkey} size="medium" />
                </div>
              )}
              <div
                className={cn(
                  'flex min-w-0 max-w-full sm:max-w-[80%] flex-col gap-0.5',
                  group.isOwn ? 'items-end' : 'items-start'
                )}
              >
                {group.items.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={group.isOwn}
                    sendingStatus={group.isOwn ? dmService.getSendingStatus(message.id) : undefined}
                    onReply={onReply}
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
        ))
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
  sendingStatus,
  onReply,
  onScrollToMessage,
  isHighlighted,
  isElevated,
  refCallback
}: {
  message: TDmMessage
  isOwn: boolean
  sendingStatus?: 'sending' | 'sent' | 'failed'
  onReply?: (message: TDmMessage) => void
  onScrollToMessage?: (id: string) => void
  isHighlighted?: boolean
  isElevated?: boolean
  refCallback?: (el: HTMLDivElement | null) => void
}) {
  const hasEmbeddedContent = /https?:\/\/|nostr:|note1|nevent1/.test(message.content)
  const [copied, setCopied] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  const handleTap = useCallback(() => {
    setShowActions(true)
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setShowActions(false), 3000)
  }, [])

  const bubbleClass = cn(
    'overflow-hidden break-words rounded-md px-3 py-1.5 transition-all duration-500',
    hasEmbeddedContent ? 'w-full' : 'w-fit',
    isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary',
    isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
  )

  return (
    <div
      ref={refCallback}
      onClick={handleTap}
      className={cn(
        'group/msg flex max-w-full flex-col',
        hasEmbeddedContent && 'w-full',
        isOwn ? 'items-end' : 'items-start',
        isElevated && 'relative z-10'
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
          />
        </button>
      )}
      <div
        className={cn('flex min-w-0 max-w-full items-center gap-2', isOwn ? 'flex-row' : 'flex-row-reverse')}
      >
        <div className={cn('flex shrink-0 items-center gap-1 opacity-0 transition-opacity [@media(hover:hover)]:group-hover/msg:opacity-100', showActions && 'opacity-100', isOwn ? 'flex-row' : 'flex-row-reverse')}>
          <button
            onClick={handleCopy}
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
          {onReply && (
            <button
              onClick={() => onReply(message)}
              className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
            >
              <Reply className="h-4 w-4" />
            </button>
          )}
        </div>
        {sendingStatus && (
          <div className="pb-1">
            <SendingStatusIcon status={sendingStatus} />
          </div>
        )}
        <div className={bubbleClass}>
          <Content
            content={message.content}
            className={cn(
              'select-text text-base',
              isOwn && '[&>div]:text-foreground',
              '[&_.bg-card:hover]:bg-accent'
            )}
          />
        </div>
      </div>
    </div>
  )
}

function SendingStatusIcon({ status }: { status: 'sending' | 'sent' | 'failed' }) {
  switch (status) {
    case 'sending':
      return <Clock className="h-3 w-3 text-muted-foreground" />
    case 'sent':
      return <Check className="h-3 w-3 text-muted-foreground" />
    case 'failed':
      return <AlertCircle className="h-3 w-3 text-destructive" />
  }
}
