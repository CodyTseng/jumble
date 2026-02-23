import Tabs from '@/components/Tabs'
import TrustScoreFilter from '@/components/TrustScoreFilter'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import UserAvatar, { SimpleUserAvatar } from '@/components/UserAvatar'
import Username, { SimpleUsername } from '@/components/Username'
import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { toDmConversation } from '@/lib/link'
import { isTouchDevice } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import dmService from '@/services/dm.service'
import { TDmConversation } from '@/types'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { MessageSquare, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

dayjs.extend(relativeTime)

type TDmTab = 'messages' | 'requests'

export default function DmList() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { push } = useSecondaryPage()
  const { mutePubkeySet } = useMuteList()
  const { getMinTrustScore, meetsMinTrustScore } = useUserTrust()
  const [conversations, setConversations] = useState<TDmConversation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TDmTab>('messages')
  const [deleteTarget, setDeleteTarget] = useState<TDmConversation | null>(null)
  const [trustFilterOpen, setTrustFilterOpen] = useState(false)
  const [trustedPubkeys, setTrustedPubkeys] = useState<Set<string> | null>(null)
  const trustScoreThreshold = getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.DM)

  const loadConversations = useCallback(async () => {
    if (!pubkey) return

    try {
      const convs = await dmService.getConversations(pubkey)
      setConversations(convs)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }, [pubkey])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (!pubkey) return

    const unsubscribe = dmService.onDataChanged(() => {
      loadConversations()
    })

    return () => {
      unsubscribe()
    }
  }, [pubkey, loadConversations])

  useEffect(() => {
    if (!trustScoreThreshold || trustScoreThreshold <= 0) {
      setTrustedPubkeys(null)
      return
    }

    let cancelled = false
    const checkTrust = async () => {
      const pubkeys = [...new Set(conversations.map((c) => c.pubkey))]
      const results = await Promise.allSettled(
        pubkeys.map(async (pubkey) => ({
          pubkey,
          trusted: await meetsMinTrustScore(pubkey, trustScoreThreshold)
        }))
      )
      if (!cancelled) {
        setTrustedPubkeys(
          new Set(
            results
              .filter((r) => r.status === 'fulfilled' && r.value.trusted)
              .map((r) => (r.status === 'fulfilled' ? r.value.pubkey : ''))
          )
        )
      }
    }
    checkTrust()
    return () => {
      cancelled = true
    }
  }, [conversations, trustScoreThreshold, meetsMinTrustScore])

  const filteredConversations = useMemo(() => {
    const filtered = conversations.filter((c) => !mutePubkeySet.has(c.pubkey))
    if (activeTab === 'messages') {
      return filtered.filter((c) => c.hasReplied)
    }
    let requests = filtered.filter((c) => !c.hasReplied)
    if (trustedPubkeys) {
      requests = requests.filter((c) => trustedPubkeys.has(c.pubkey))
    }
    return requests
  }, [conversations, activeTab, mutePubkeySet, trustedPubkeys])

  const hasUnreadMessages = useMemo(() => {
    return conversations.some(
      (c) => c.hasReplied && c.unreadCount > 0 && !mutePubkeySet.has(c.pubkey)
    )
  }, [conversations, mutePubkeySet])

  const hasUnreadRequests = useMemo(() => {
    return conversations.some(
      (c) =>
        !c.hasReplied &&
        c.unreadCount > 0 &&
        !mutePubkeySet.has(c.pubkey) &&
        (!trustedPubkeys || trustedPubkeys.has(c.pubkey))
    )
  }, [conversations, mutePubkeySet, trustedPubkeys])

  const handleConversationClick = (conv: TDmConversation) => {
    push(toDmConversation(conv.pubkey))
  }

  const handleDelete = async () => {
    if (!pubkey || !deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    setConversations((prev) => prev.filter((c) => c.key !== target.key))
    try {
      await dmService.deleteConversation(pubkey, target.pubkey)
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div>
      <Tabs
        tabs={[
          { value: 'messages', label: 'Messages', dot: hasUnreadMessages },
          { value: 'requests', label: 'Requests', dot: hasUnreadRequests }
        ]}
        value={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TDmTab)}
        options={
          activeTab === 'requests' ? (
            <TrustScoreFilter
              filterId={SPECIAL_TRUST_SCORE_FILTER_ID.DM}
              onOpenChange={setTrustFilterOpen}
            />
          ) : null
        }
        active={trustFilterOpen}
      />
      {filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-4 p-8 text-center">
          <MessageSquare className="h-16 w-16 text-muted-foreground" />
          <div className="space-y-2">
            {activeTab === 'messages' ? (
              <>
                <h3 className="font-medium">{t('No conversations yet')}</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t(
                    "Start a conversation by visiting someone's profile and clicking the message button."
                  )}
                </p>
              </>
            ) : (
              <>
                <h3 className="font-medium">{t('No message requests')}</h3>
                <p className="max-w-sm text-sm text-muted-foreground">
                  {t("Messages from people you haven't replied to will appear here.")}
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="divide-y border-b">
          {filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.key}
              conversation={conv}
              onClick={() => handleConversationClick(conv)}
              onDelete={() => setDeleteTarget(conv)}
            />
          ))}
        </div>
      )}
      <DeleteConversationConfirmation
        open={!!deleteTarget}
        setOpen={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={handleDelete}
      />
    </div>
  )
}

function ConversationItem({
  conversation,
  onClick,
  onDelete
}: {
  conversation: TDmConversation
  onClick: () => void
  onDelete: () => void
}) {
  const { isSmallScreen } = useScreenSize()
  const timeAgo = dayjs.unix(conversation.lastMessageAt).fromNow()

  if (isSmallScreen) {
    return (
      <SwipeableConversationItem
        conversation={conversation}
        timeAgo={timeAgo}
        onClick={onClick}
        onDelete={onDelete}
      />
    )
  }

  return (
    <ContextMenuConversationItem
      conversation={conversation}
      timeAgo={timeAgo}
      onClick={onClick}
      onDelete={onDelete}
    />
  )
}

function ContextMenuConversationItem({
  conversation,
  timeAgo,
  onClick,
  onDelete
}: {
  conversation: TDmConversation
  timeAgo: string
  onClick: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <>
      <button
        className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50"
        onClick={onClick}
        onContextMenu={handleContextMenu}
      >
        <ConversationItemContent conversation={conversation} timeAgo={timeAgo} />
      </button>
      {contextMenu &&
        createPortal(
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault()
              setContextMenu(null)
            }}
          >
            <div
              className="absolute min-w-48 rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
              style={{ left: contextMenu.x, top: contextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-destructive transition-colors hover:bg-accent"
                onClick={() => {
                  setContextMenu(null)
                  onDelete()
                }}
              >
                <Trash2 className="h-4 w-4" />
                {t('Delete conversation')}
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}

function SwipeableConversationItem({
  conversation,
  timeAgo,
  onClick,
  onDelete
}: {
  conversation: TDmConversation
  timeAgo: string
  onClick: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const slideRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const baseX = useRef(0)
  const currentX = useRef(0)
  const isSwipingRef = useRef(false)
  const directionLockedRef = useRef(false)

  const THRESHOLD = 80

  const applyTransform = (x: number, animate: boolean) => {
    if (!slideRef.current) return
    slideRef.current.style.transitionDuration = animate ? '200ms' : '0ms'
    slideRef.current.style.transform = `translateX(${x}px)`
    currentX.current = x
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    baseX.current = currentX.current
    isSwipingRef.current = false
    directionLockedRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const deltaX = e.touches[0].clientX - touchStartX.current
    const deltaY = e.touches[0].clientY - touchStartY.current

    if (!directionLockedRef.current) {
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        directionLockedRef.current = true
        isSwipingRef.current = Math.abs(deltaX) > Math.abs(deltaY)
      }
      return
    }

    if (!isSwipingRef.current) return

    const target = Math.min(0, baseX.current + deltaX)
    applyTransform(Math.max(-THRESHOLD * 1.5, target), false)
  }

  const handleTouchEnd = () => {
    if (!isSwipingRef.current) return

    if (currentX.current < -THRESHOLD / 2) {
      applyTransform(-THRESHOLD, true)
    } else {
      applyTransform(0, true)
    }
  }

  const handleClick = () => {
    if (currentX.current < 0) {
      applyTransform(0, true)
      return
    }
    onClick()
  }

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex items-center" style={{ width: THRESHOLD }}>
        <button
          className="flex h-full w-full items-center justify-center bg-destructive text-destructive-foreground"
          onClick={(e) => {
            e.stopPropagation()
            applyTransform(0, true)
            onDelete()
          }}
        >
          <Trash2 className="h-5 w-5" />
          <span className="ml-1 text-xs">{t('Delete')}</span>
        </button>
      </div>
      <div
        ref={slideRef}
        className="relative bg-background ease-out"
        style={{ transitionProperty: 'transform', transitionDuration: '200ms' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          className="flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50"
          onClick={handleClick}
        >
          <ConversationItemContent conversation={conversation} timeAgo={timeAgo} />
        </button>
      </div>
    </div>
  )
}

function ConversationItemContent({
  conversation,
  timeAgo
}: {
  conversation: TDmConversation
  timeAgo: string
}) {
  const supportTouch = useMemo(() => isTouchDevice(), [])

  return (
    <>
      {supportTouch ? (
        <SimpleUserAvatar userId={conversation.pubkey} />
      ) : (
        <UserAvatar userId={conversation.pubkey} size="normal" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          {supportTouch ? (
            <SimpleUsername
              userId={conversation.pubkey}
              className="truncate font-medium"
              skeletonClassName="h-4"
            />
          ) : (
            <Username
              userId={conversation.pubkey}
              className="truncate font-medium"
              skeletonClassName="h-4"
            />
          )}
          <span className="shrink-0 text-xs text-muted-foreground">{timeAgo}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm text-muted-foreground">
            {conversation.lastMessageContent}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-primary px-1 text-xs font-medium text-primary-foreground">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

function DeleteConversationConfirmation({
  open,
  setOpen,
  onConfirm
}: {
  open: boolean
  setOpen: (open: boolean) => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Drawer defaultOpen={false} open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('Delete conversation')}</DrawerTitle>
            <DrawerDescription>
              {t(
                'Are you sure you want to delete this conversation? All messages will be permanently removed from this device.'
              )}
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full">
              {t('Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onConfirm()
                setOpen(false)
              }}
              className="w-full"
            >
              {t('Delete')}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <AlertDialog defaultOpen={false} open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Delete conversation')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              'Are you sure you want to delete this conversation? All messages will be permanently removed from this device.'
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t('Delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
