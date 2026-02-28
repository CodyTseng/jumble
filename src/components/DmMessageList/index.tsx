import ContentPreviewContent from '@/components/ContentPreview/Content'
import Emoji from '@/components/Emoji'
import {
  EmbeddedHashtag,
  EmbeddedLNInvoice,
  EmbeddedMention,
  EmbeddedNote,
  EmbeddedWebsocketUrl
} from '@/components/Embedded'
import ExternalLink from '@/components/ExternalLink'
import ImageGallery from '@/components/ImageGallery'
import MediaPlayer from '@/components/MediaPlayer'
import UserAvatar from '@/components/UserAvatar'
import { SimpleUsername } from '@/components/Username'
import XEmbeddedPost from '@/components/XEmbeddedPost'
import YoutubeEmbeddedPlayer from '@/components/YoutubeEmbeddedPlayer'
import { ExtendedKind } from '@/constants'
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
import { useNostr } from '@/providers/NostrProvider'
import { usePageActive } from '@/providers/PageActiveProvider'
import cryptoFileService from '@/services/crypto-file.service'
import dmService from '@/services/dm.service'
import { TImetaInfo, TDmMessage } from '@/types'
import dayjs from 'dayjs'
import { AlertCircle, ArrowDown, Check, Clock, Copy, Download, Loader2, Reply } from 'lucide-react'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const isFileMessage = message.decryptedRumor?.kind === ExtendedKind.RUMOR_FILE
  const hasBlocks = isFileMessage || /https?:\/\/|nostr:n(?:ote|event|addr)1|note1|nevent1|lnbc/i.test(message.content)
  const [copied, setCopied] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  const handleTap = useCallback(() => {
    if (!window.matchMedia('(hover: hover)').matches) {
      setShowActions(true)
      clearTimeout(hideTimerRef.current)
      hideTimerRef.current = setTimeout(() => setShowActions(false), 1500)
    }
  }, [])

  const bubbleClass = cn(
    'overflow-hidden break-words rounded-lg px-3 py-1.5',
    'w-fit max-w-full',
    isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary'
  )

  return (
    <div
      ref={refCallback}
      onClick={handleTap}
      className={cn(
        'group/msg flex w-full max-w-full flex-col',
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
            emojiInfos={getEmojiInfosFromEmojiTags(message.replyTo.tags)}
          />
        </button>
      )}
      <div
        className={cn('flex min-w-0 max-w-full items-end gap-2', hasBlocks && 'w-full', isOwn ? 'flex-row' : 'flex-row-reverse')}
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
        {isFileMessage ? (
          <EncryptedFileMessage message={message} isOwn={isOwn} isHighlighted={isHighlighted} />
        ) : (
          <DmContent content={message.content} isOwn={isOwn} bubbleClass={bubbleClass} isHighlighted={isHighlighted} tags={message.decryptedRumor?.tags} />
        )}
      </div>
    </div>
  )
}

type TDmSegment =
  | { kind: 'text'; nodes: TEmbeddedNode[] }
  | { kind: 'block'; node: TEmbeddedNode }

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
  const { allImages, segments } = useMemo(() => {
    if (!content) return { allImages: [], segments: [] }

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

    return { allImages, segments }
  }, [content])

  const emojiInfos = useMemo(() => getEmojiInfosFromEmojiTags(tags), [tags])

  if (segments.length === 0) return null

  let imageIndex = 0

  return (
    <div className={cn('flex min-w-0 max-w-full flex-col gap-1 rounded-lg transition-all duration-500', segments.some((s) => s.kind === 'block') && 'flex-1', isOwn ? 'items-end' : 'items-start', isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}>
      {segments.map((seg, si) => {
        if (seg.kind === 'text') {
          return (
            <div key={si} className={bubbleClass}>
              <div
                className={cn(
                  'whitespace-pre-wrap text-wrap break-words select-text text-base',
                  isOwn && '[&>div]:text-foreground',
                  '[&_.bg-card:hover]:bg-accent'
                )}
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
  const [blobUrl, setBlobUrl] = useState<string | null>(
    decryptedBlobCache.get(message.id) ?? null
  )
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(!decryptedBlobCache.has(message.id))

  const tags = message.decryptedRumor?.tags ?? []
  const fileType = tags.find((t) => t[0] === 'file-type')?.[1] ?? ''
  const hexKey = tags.find((t) => t[0] === 'decryption-key')?.[1]
  const hexNonce = tags.find((t) => t[0] === 'decryption-nonce')?.[1]
  const fileUrl = message.content

  useEffect(() => {
    if (decryptedBlobCache.has(message.id)) return
    if (!hexKey || !hexNonce || !fileUrl) {
      setError(true)
      setLoading(false)
      return
    }

    let cancelled = false
    const decrypt = async () => {
      try {
        const key = cryptoFileService.hexToBytes(hexKey)
        const nonce = cryptoFileService.hexToBytes(hexNonce)
        const response = await fetch(fileUrl)
        if (!response.ok) throw new Error('Failed to fetch file')
        const encryptedData = await response.arrayBuffer()
        const decrypted = await cryptoFileService.decryptFile(encryptedData, key, nonce)
        if (cancelled) return
        const blob = new Blob([decrypted], { type: fileType || 'application/octet-stream' })
        const url = URL.createObjectURL(blob)
        decryptedBlobCache.set(message.id, url)
        setBlobUrl(url)
      } catch (e) {
        console.error('Failed to decrypt file:', e)
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    decrypt()
    return () => {
      cancelled = true
    }
  }, [message.id, hexKey, hexNonce, fileUrl, fileType])

  const wrapperClass = cn(
    'flex min-w-0 max-w-full flex-1 flex-col',
    isOwn ? 'items-end' : 'items-start',
    isHighlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-lg'
  )

  if (loading) {
    return (
      <div className={wrapperClass}>
        <div className={cn('flex h-40 w-40 items-center justify-center overflow-hidden rounded-lg', isOwn ? 'bg-primary/20' : 'bg-secondary')}>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !blobUrl) {
    return (
      <div className={wrapperClass}>
        <div className={cn('flex h-20 w-40 items-center justify-center gap-2 overflow-hidden rounded-lg', isOwn ? 'bg-primary/20' : 'bg-secondary')}>
          <AlertCircle className="h-4 w-4 text-destructive" />
          <span className="text-xs text-muted-foreground">{t('Failed to decrypt')}</span>
        </div>
      </div>
    )
  }

  if (fileType.startsWith('image/')) {
    return (
      <div className={wrapperClass}>
        <ImageGallery images={[{ url: blobUrl }]} start={0} end={1} />
      </div>
    )
  }

  if (fileType.startsWith('video/')) {
    return (
      <div className={wrapperClass}>
        <div className="overflow-hidden rounded-lg">
          <video src={blobUrl} controls className="max-h-80 max-w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (fileType.startsWith('audio/')) {
    return (
      <div className={wrapperClass}>
        <div className={cn('overflow-hidden rounded-lg px-3 py-2', isOwn ? 'bg-primary/20' : 'bg-secondary')}>
          <audio src={blobUrl} controls className="max-w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className={wrapperClass}>
      <a
        href={blobUrl}
        download
        className={cn('flex items-center gap-2 overflow-hidden rounded-lg px-3 py-2', isOwn ? 'bg-primary text-primary-foreground' : 'bg-secondary')}
      >
        <Download className="h-4 w-4 shrink-0" />
        <span className="truncate text-sm">{t('Download file')}</span>
      </a>
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
