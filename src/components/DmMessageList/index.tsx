import Content from '@/components/Content'
import ContentPreviewContent from '@/components/ContentPreview/Content'
import UserAvatar from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import dmService from '@/services/dm.service'
import { TDmMessage } from '@/types'
import dayjs from 'dayjs'
import { AlertCircle, Check, Clock, Loader2, Reply } from 'lucide-react'
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
  const [messages, setMessages] = useState<TDmMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [, setStatusVersion] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const isInitialLoad = useRef(true)
  const lastMessageIdRef = useRef<string | null>(null)
  const messageRefsMap = useRef<Map<string, HTMLDivElement>>(new Map())
  const [highlightedId, setHighlightedId] = useState<string | null>(null)
  const [elevatedId, setElevatedId] = useState<string | null>(null)

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
      setMessages(msgs)
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

    dmService.markConversationAsRead(pubkey, otherPubkey)
  }, [pubkey, otherPubkey])

  useEffect(() => {
    if (!pubkey) return

    const conversationKey = dmService.getConversationKey(pubkey, otherPubkey)

    const unsubMessage = dmService.onNewMessage((message: TDmMessage) => {
      if (message.conversationKey === conversationKey) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev
          return [...prev, message]
        })
        dmService.markConversationAsRead(pubkey, otherPubkey)
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
  }, [pubkey, otherPubkey, loadMessages])

  // Auto-scroll: on initial load, and when own new message is appended
  useEffect(() => {
    if (messages.length === 0) return

    const lastMessage = messages[messages.length - 1]

    if (isInitialLoad.current) {
      bottomRef.current?.scrollIntoView()
      isInitialLoad.current = false
    } else if (lastMessage.id !== lastMessageIdRef.current && lastMessage.senderPubkey === pubkey) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    lastMessageIdRef.current = lastMessage.id
  }, [messages, pubkey])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return

    const { scrollTop } = containerRef.current
    if (scrollTop < 100 && !isLoadingMore && hasMore) {
      loadMoreMessages()
    }
  }, [loadMoreMessages, isLoadingMore, hasMore])

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
    <div
      ref={containerRef}
      className="flex-1 select-text overflow-y-auto p-4"
      onScroll={handleScroll}
    >
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
          items: {
            message: TDmMessage
            isGroupStart: boolean
            isGroupEnd: boolean
          }[]
        }[] = []

        messages.forEach((message, index) => {
          const isOwn = message.senderPubkey === pubkey
          const showTime = index === 0 || message.createdAt - messages[index - 1].createdAt > 300
          const nextShowTime =
            index < messages.length - 1 && messages[index + 1].createdAt - message.createdAt > 300
          const isGroupStart =
            index === 0 || messages[index - 1].senderPubkey !== message.senderPubkey || showTime
          const isGroupEnd =
            index === messages.length - 1 ||
            messages[index + 1].senderPubkey !== message.senderPubkey ||
            nextShowTime

          if (isGroupStart) {
            groups.push({
              isOwn,
              showTime,
              timeCreatedAt: message.createdAt,
              isFirst: index === 0,
              items: []
            })
          }
          groups[groups.length - 1].items.push({ message, isGroupStart, isGroupEnd })
        })

        return groups.map((group) => (
          <Fragment key={group.items[0].message.id}>
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
                <div className="w-10 shrink-0 self-end">
                  <UserAvatar userId={group.items[0].message.senderPubkey} />
                </div>
              )}
              <div
                className={cn(
                  'flex min-w-0 max-w-[75%] flex-col gap-0.5 pt-0.5',
                  group.isOwn ? 'items-end' : 'items-start'
                )}
              >
                {group.items.map(({ message, isGroupStart, isGroupEnd }) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    isOwn={group.isOwn}
                    isGroupStart={isGroupStart}
                    isGroupEnd={isGroupEnd}
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
  )
}

function MessageBubble({
  message,
  isOwn,
  isGroupStart,
  isGroupEnd,
  sendingStatus,
  onReply,
  onScrollToMessage,
  isHighlighted,
  isElevated,
  refCallback
}: {
  message: TDmMessage
  isOwn: boolean
  isGroupStart: boolean
  isGroupEnd: boolean
  sendingStatus?: 'sending' | 'sent' | 'failed'
  onReply?: (message: TDmMessage) => void
  onScrollToMessage?: (id: string) => void
  isHighlighted?: boolean
  isElevated?: boolean
  refCallback?: (el: HTMLDivElement | null) => void
}) {
  const hasEmbeddedContent = /https?:\/\/|nostr:|note1|nevent1/.test(message.content)

  const bubbleClass = isOwn
    ? cn(
        'max-w-full overflow-hidden break-words px-3 py-1.5 rounded-tl-md rounded-bl-md bg-primary text-primary-foreground transition-all duration-500',
        hasEmbeddedContent ? 'w-full' : 'w-fit',
        isGroupStart ? 'rounded-tr-md' : 'rounded-tr-[2px]',
        isGroupEnd && !isGroupStart ? 'rounded-br-md' : 'rounded-br-[2px]',
        isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )
    : cn(
        'max-w-full overflow-hidden break-words px-3 py-1.5 rounded-tr-md rounded-br-md bg-secondary transition-all duration-500',
        hasEmbeddedContent ? 'w-full' : 'w-fit',
        isGroupStart ? 'rounded-tl-md' : 'rounded-tl-[2px]',
        isGroupEnd && !isGroupStart ? 'rounded-bl-md' : 'rounded-bl-[2px]',
        isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
      )

  return (
    <div
      ref={refCallback}
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
        className={cn('flex min-w-0 max-w-full gap-1', isOwn ? 'flex-row' : 'flex-row-reverse')}
      >
        {onReply && (
          <button
            onClick={() => onReply(message)}
            className="mt-auto shrink-0 rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover/msg:opacity-100"
          >
            <Reply className="h-3.5 w-3.5" />
          </button>
        )}
        {sendingStatus && (
          <div className="mt-auto pb-1">
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
