import BackButton from '@/components/BackButton'
import BottomNavigationBar from '@/components/BottomNavigationBar'
import ScrollToTopButton from '@/components/ScrollToTopButton'
import { Titlebar } from '@/components/Titlebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSecondaryPage } from '@/PageManager'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useEffect, useRef, useState } from 'react'

export default function SecondaryPageLayout({
  children,
  index,
  title,
  controls,
  hideBackButton = false,
  displayScrollToTopButton = false
}: {
  children?: React.ReactNode
  index?: number
  title?: React.ReactNode
  controls?: React.ReactNode
  hideBackButton?: boolean
  displayScrollToTopButton?: boolean
}): JSX.Element {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [lastScrollTop, setLastScrollTop] = useState(0)
  const { isSmallScreen } = useScreenSize()
  const { currentIndex } = useSecondaryPage()

  useEffect(() => {
    if (isSmallScreen) {
      window.scrollTo({ top: 0 })
      setVisible(true)
      return
    }
  }, [])

  useEffect(() => {
    if (currentIndex !== index) return

    const handleScroll = () => {
      const atBottom = isSmallScreen
        ? window.innerHeight + window.scrollY >= document.body.offsetHeight - 20
        : scrollAreaRef.current
          ? scrollAreaRef.current?.clientHeight + scrollAreaRef.current?.scrollTop >=
            scrollAreaRef.current?.scrollHeight - 20
          : false
      if (atBottom) {
        setVisible(true)
        return
      }

      const scrollTop = (isSmallScreen ? window.scrollY : scrollAreaRef.current?.scrollTop) || 0
      const diff = scrollTop - lastScrollTop
      if (scrollTop <= 800) {
        setVisible(true)
        setLastScrollTop(scrollTop)
        return
      }

      if (diff > 20) {
        setVisible(false)
        setLastScrollTop(scrollTop)
      } else if (diff < -20) {
        setVisible(true)
        setLastScrollTop(scrollTop)
      }
    }

    if (isSmallScreen) {
      window.addEventListener('scroll', handleScroll)
      return () => {
        window.removeEventListener('scroll', handleScroll)
      }
    }

    scrollAreaRef.current?.addEventListener('scroll', handleScroll)
    return () => {
      scrollAreaRef.current?.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollTop, isSmallScreen, currentIndex])

  return (
    <ScrollArea
      className="sm:h-screen sm:overflow-auto pt-12 sm:pt-0"
      scrollBarClassName="sm:z-50"
      ref={scrollAreaRef}
      style={{
        paddingBottom: isSmallScreen ? 'calc(env(safe-area-inset-bottom) + 3rem)' : ''
      }}
    >
      <SecondaryPageTitlebar
        title={title}
        controls={controls}
        hideBackButton={hideBackButton}
        visible={visible}
      />
      <div className="pb-4 mt-2">{children}</div>
      {displayScrollToTopButton && (
        <ScrollToTopButton scrollAreaRef={scrollAreaRef} visible={visible && lastScrollTop > 800} />
      )}
      {isSmallScreen && <BottomNavigationBar visible={visible} />}
    </ScrollArea>
  )
}

export function SecondaryPageTitlebar({
  title,
  controls,
  hideBackButton = false,
  visible = true
}: {
  title?: React.ReactNode
  controls?: React.ReactNode
  hideBackButton?: boolean
  visible?: boolean
}): JSX.Element {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Titlebar
        className="h-12 flex gap-1 p-1 items-center justify-between font-semibold"
        visible={visible}
      >
        <BackButton hide={hideBackButton}>{title}</BackButton>
        <div className="flex-shrink-0">{controls}</div>
      </Titlebar>
    )
  }

  return (
    <Titlebar className="h-12 flex gap-1 p-1 justify-between items-center font-semibold">
      <div className="flex items-center gap-1 flex-1 w-0">
        <BackButton hide={hideBackButton}>{title}</BackButton>
      </div>
      <div className="flex-shrink-0">{controls}</div>
    </Titlebar>
  )
}
