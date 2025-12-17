import NoteList, { TNoteListRef } from '@/components/NoteList'
import Tabs from '@/components/Tabs'
import UserAggregationList, { TUserAggregationListRef } from '@/components/UserAggregationList'
import { isTouchDevice } from '@/lib/utils'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import storage from '@/services/local-storage.service'
import { TFeedSubRequest, TNoteListMode } from '@/types'
import { useEffect, useMemo, useRef, useState } from 'react'
import KindFilter from '../KindFilter'
import { RefreshButton } from '../RefreshButton'

export default function NormalFeed({
  subRequests,
  areAlgoRelays = false,
  isMainFeed = false,
  showRelayCloseReason = false,
  disable24hMode = false
}: {
  subRequests: TFeedSubRequest[]
  areAlgoRelays?: boolean
  isMainFeed?: boolean
  showRelayCloseReason?: boolean
  disable24hMode?: boolean
}) {
  const { hideUntrustedNotes } = useUserTrust()
  const { showKinds } = useKindFilter()
  const [temporaryShowKinds, setTemporaryShowKinds] = useState(showKinds)
  const [listMode, setListMode] = useState<TNoteListMode>(() => storage.getNoteListMode())
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const noteListRef = useRef<TNoteListRef>(null)
  const userAggregationListRef = useRef<TUserAggregationListRef>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const showKindsFilter = useMemo(() => {
    return subRequests.every((req) => !req.filter.kinds?.length)
  }, [subRequests])

  // Touch swipe state for tab switching
  const touchStartX = useRef<number>(0)
  const touchStartY = useRef<number>(0)
  const touchStartTime = useRef<number>(0)
  const currentTranslateX = useRef<number>(0)
  const isSwiping = useRef<boolean>(false)
  const isAnimating = useRef<boolean>(false)

  const tabs = useMemo(
    () => [
      { value: 'posts', label: 'Notes' },
      { value: 'postsAndReplies', label: 'Replies' },
      ...(!disable24hMode ? [{ value: '24h', label: '24h Pulse' }] : [])
    ],
    [disable24hMode]
  )

  const handleListModeChange = (mode: TNoteListMode) => {
    setListMode(mode)
    if (isMainFeed) {
      storage.setNoteListMode(mode)
    }
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleShowKindsChange = (newShowKinds: number[]) => {
    setTemporaryShowKinds(newShowKinds)
    noteListRef.current?.scrollToTop()
  }

  // Handle touch swipe for tab switching on content area with follow gesture
  useEffect(() => {
    if (!supportTouch || !containerRef.current) return

    const container = containerRef.current
    const currentListMode = listMode === '24h' && disable24hMode ? 'posts' : listMode

    const handleTouchStart = (e: TouchEvent) => {
      if (isAnimating.current) return

      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
      touchStartTime.current = Date.now()
      isSwiping.current = false
      currentTranslateX.current = 0
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (isAnimating.current) return

      const deltaX = e.touches[0].clientX - touchStartX.current
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current)
      const absDeltaX = Math.abs(deltaX)

      // Only start swiping if horizontal movement is greater than vertical
      if (!isSwiping.current && absDeltaX > 10) {
        if (absDeltaX > deltaY) {
          isSwiping.current = true
        } else {
          return
        }
      }

      if (isSwiping.current) {
        // Prevent scrolling when swiping
        e.preventDefault()

        const currentIndex = tabs.findIndex((tab) => tab.value === currentListMode)
        
        // Apply resistance at boundaries
        let translateX = deltaX
        if ((deltaX > 0 && currentIndex === 0) || (deltaX < 0 && currentIndex === tabs.length - 1)) {
          // Add resistance at boundaries (reduce movement to 30%)
          translateX = deltaX * 0.3
        }

        currentTranslateX.current = translateX
        container.style.transition = 'none'
        container.style.transform = `translateX(${translateX}px)`
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwiping.current || isAnimating.current) {
        isSwiping.current = false
        return
      }

      const deltaX = e.changedTouches[0].clientX - touchStartX.current
      const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartY.current)
      const absDeltaX = Math.abs(deltaX)
      const touchDuration = Date.now() - touchStartTime.current
      const velocity = absDeltaX / touchDuration // px per ms

      const currentIndex = tabs.findIndex((tab) => tab.value === currentListMode)
      
      // Determine if should switch tab
      // Switch if: moved > 100px OR (moved > 50px AND velocity > 0.3)
      const shouldSwitch = absDeltaX > 100 || (absDeltaX > 50 && velocity > 0.3)

      if (shouldSwitch && absDeltaX > deltaY) {
        if (deltaX > 0 && currentIndex > 0) {
          // Swipe right - go to previous tab
          animateToTab(container, 'next', () => {
            handleListModeChange(tabs[currentIndex - 1].value as TNoteListMode)
          })
        } else if (deltaX < 0 && currentIndex < tabs.length - 1) {
          // Swipe left - go to next tab
          animateToTab(container, 'prev', () => {
            handleListModeChange(tabs[currentIndex + 1].value as TNoteListMode)
          })
        } else {
          // At boundary, bounce back
          animateToTab(container, 'cancel')
        }
      } else {
        // Not enough movement, bounce back
        animateToTab(container, 'cancel')
      }

      isSwiping.current = false
    }

    const animateToTab = (
      element: HTMLElement,
      direction: 'prev' | 'next' | 'cancel',
      callback?: () => void
    ) => {
      isAnimating.current = true
      element.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'

      if (direction === 'cancel') {
        // Bounce back to original position
        element.style.transform = 'translateX(0)'
        setTimeout(() => {
          isAnimating.current = false
        }, 300)
      } else {
        // Slide out to complete the transition
        const targetX = direction === 'next' ? window.innerWidth : -window.innerWidth
        element.style.transform = `translateX(${targetX}px)`
        
        setTimeout(() => {
          if (callback) callback()
          element.style.transition = 'none'
          element.style.transform = 'translateX(0)'
          setTimeout(() => {
            isAnimating.current = false
          }, 50)
        }, 300)
      }
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [supportTouch, listMode, disable24hMode, tabs])

  return (
    <>
      <Tabs
        value={listMode === '24h' && disable24hMode ? 'posts' : listMode}
        tabs={tabs}
        onTabChange={(listMode) => {
          handleListModeChange(listMode as TNoteListMode)
        }}
        options={
          <>
            {!supportTouch && (
              <RefreshButton
                onClick={() => {
                  if (listMode === '24h') {
                    userAggregationListRef.current?.refresh()
                  } else {
                    noteListRef.current?.refresh()
                  }
                }}
              />
            )}
            {showKindsFilter && (
              <KindFilter
                showKinds={temporaryShowKinds}
                onShowKindsChange={handleShowKindsChange}
              />
            )}
          </>
        }
      />
      <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
      <div ref={containerRef} className="overflow-hidden">
        {listMode === '24h' && !disable24hMode ? (
          <UserAggregationList
            ref={userAggregationListRef}
            showKinds={temporaryShowKinds}
            subRequests={subRequests}
            areAlgoRelays={areAlgoRelays}
            showRelayCloseReason={showRelayCloseReason}
          />
        ) : (
          <NoteList
            ref={noteListRef}
            showKinds={temporaryShowKinds}
            subRequests={subRequests}
            hideReplies={listMode === 'posts'}
            hideUntrustedNotes={hideUntrustedNotes}
            areAlgoRelays={areAlgoRelays}
            showRelayCloseReason={showRelayCloseReason}
          />
        )}
      </div>
    </>
  )
}
