import BackButton from '@/components/BackButton'
import BottomNavigationBar from '@/components/BottomNavigationBar'
import ScrollToTopButton from '@/components/ScrollToTopButton'
import ThemeToggle from '@/components/ThemeToggle'
import { Titlebar } from '@/components/Titlebar'
import { useSecondaryPage } from '@/PageManager'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useEffect, useRef, useState } from 'react'

export default function SecondaryPageLayout({
  children,
  index,
  titlebarContent,
  hideBackButton = false,
  hideScrollToTopButton = false
}: {
  children?: React.ReactNode
  index?: number
  titlebarContent?: React.ReactNode
  hideBackButton?: boolean
  hideScrollToTopButton?: boolean
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
      const scrollTop = (isSmallScreen ? window.scrollY : scrollAreaRef.current?.scrollTop) || 0
      const diff = scrollTop - lastScrollTop
      if (scrollTop <= 100) {
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
    <div
      className="sm:h-screen sm:overflow-auto"
      ref={scrollAreaRef}
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}
    >
      <SecondaryPageTitlebar
        content={titlebarContent}
        hideBackButton={hideBackButton}
        visible={visible}
      />
      <div className="pb-4 mt-2">{children}</div>
      <ScrollToTopButton
        scrollAreaRef={scrollAreaRef}
        visible={!hideScrollToTopButton && visible && lastScrollTop > 500}
      />
      {isSmallScreen && <BottomNavigationBar visible={visible} />}
    </div>
  )
}

export function SecondaryPageTitlebar({
  content,
  hideBackButton = false,
  visible = true
}: {
  content?: React.ReactNode
  hideBackButton?: boolean
  visible?: boolean
}): JSX.Element {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Titlebar className="h-12 flex gap-1 p-1 items-center font-semibold" visible={visible}>
        <BackButton hide={hideBackButton}>{content}</BackButton>
      </Titlebar>
    )
  }

  return (
    <Titlebar className="h-12 flex gap-1 p-1 justify-between items-center font-semibold">
      <div className="flex items-center gap-1 flex-1 w-0">
        <BackButton hide={hideBackButton}>{content}</BackButton>
      </div>
      <div className="flex-shrink-0 flex items-center">
        <ThemeToggle />
      </div>
    </Titlebar>
  )
}
