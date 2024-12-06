import BackButton from '@renderer/components/BackButton'
import ScrollToTopButton from '@renderer/components/ScrollToTopButton'
import ThemeToggle from '@renderer/components/ThemeToggle'
import { Titlebar } from '@renderer/components/Titlebar'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { isMacOS } from '@renderer/lib/env'
import { cn } from '@renderer/lib/utils'
import { useScreenSize } from '@renderer/providers/ScreenSizeProvider'
import { useEffect, useRef, useState } from 'react'

export default function SecondaryPageLayout({
  children,
  titlebarContent,
  hideBackButton = false,
  hideScrollToTopButton = false
}: {
  children?: React.ReactNode
  titlebarContent?: React.ReactNode
  hideBackButton?: boolean
  hideScrollToTopButton?: boolean
}): JSX.Element {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [lastScrollTop, setLastScrollTop] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = scrollAreaRef.current?.scrollTop || 0
      if (scrollTop > lastScrollTop) {
        setVisible(false)
      } else {
        setVisible(true)
      }
      setLastScrollTop(scrollTop)
    }

    const scrollArea = scrollAreaRef.current
    scrollArea?.addEventListener('scroll', handleScroll)

    return () => {
      scrollArea?.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollTop])

  return (
    <ScrollArea ref={scrollAreaRef} className="h-full" scrollBarClassName="pt-9">
      <SecondaryPageTitlebar
        content={titlebarContent}
        hideBackButton={hideBackButton}
        visible={visible}
      />
      <div className={cn('sm:px-4 pb-4 pt-11 w-full h-full', isMacOS() ? 'max-sm:pt-20' : '')}>
        {children}
      </div>
      <ScrollToTopButton
        scrollAreaRef={scrollAreaRef}
        visible={!hideScrollToTopButton && visible}
      />
    </ScrollArea>
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
      <Titlebar className="pl-2" visible={visible}>
        <BackButton hide={hideBackButton} variant="small-screen-titlebar" />
        <div className="truncate text-lg">{content}</div>
      </Titlebar>
    )
  }

  return (
    <Titlebar className="justify-between">
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
