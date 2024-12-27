import BackButton from '@/components/BackButton'
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
    <div className="sm:h-screen sm:overflow-auto" ref={scrollAreaRef}>
      <SecondaryPageTitlebar
        content={titlebarContent}
        hideBackButton={hideBackButton}
        visible={visible}
      />
      <div className="pb-4">{children}</div>
      <ScrollToTopButton
        scrollAreaRef={scrollAreaRef}
        visible={!hideScrollToTopButton && visible && lastScrollTop > 500}
      />
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
      <Titlebar className="h-11 flex gap-1 pl-2 items-center font-semibold" visible={visible}>
        <BackButton hide={hideBackButton} variant="small-screen-titlebar" />
        <div className="truncate text-lg">{content}</div>
      </Titlebar>
    )
  }

  return (
    <Titlebar className="h-9 flex gap-1 px-2 justify-between items-center font-semibold">
      <div className="flex items-center gap-1 flex-1 w-0">
        <BackButton hide={hideBackButton} />
        <div className="truncate text-lg">{content}</div>
      </div>
      <div className="flex-shrink-0 flex items-center">
        <ThemeToggle />
      </div>
    </Titlebar>
  )
}
