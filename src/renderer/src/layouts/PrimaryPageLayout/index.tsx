import Logo from '@renderer/assets/Logo'
import AccountButton from '@renderer/components/AccountButton'
import PostButton from '@renderer/components/PostButton'
import RefreshButton from '@renderer/components/RefreshButton'
import RelaySettingsButton from '@renderer/components/RelaySettingsButton'
import ScrollToTopButton from '@renderer/components/ScrollToTopButton'
import SearchButton from '@renderer/components/SearchButton'
import ThemeToggle from '@renderer/components/ThemeToggle'
import { Titlebar } from '@renderer/components/Titlebar'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { isMacOS } from '@renderer/lib/env'
import { cn } from '@renderer/lib/utils'
import { useScreenSize } from '@renderer/providers/ScreenSizeProvider'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const PrimaryPageLayout = forwardRef(({ children }: { children?: React.ReactNode }, ref) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [lastScrollTop, setLastScrollTop] = useState(0)

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: () => {
        scrollAreaRef.current?.scrollTo({ top: 0 })
      }
    }),
    []
  )

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = scrollAreaRef.current?.scrollTop || 0
      const diff = scrollTop - lastScrollTop
      if (diff > 20) {
        setVisible(false)
        setLastScrollTop(scrollTop)
      } else if (diff < -20) {
        setVisible(true)
        setLastScrollTop(scrollTop)
      }
    }

    const scrollArea = scrollAreaRef.current
    scrollArea?.addEventListener('scroll', handleScroll)

    return () => {
      scrollArea?.removeEventListener('scroll', handleScroll)
    }
  }, [lastScrollTop])

  return (
    <ScrollArea
      ref={scrollAreaRef}
      className="h-full w-full"
      scrollBarClassName="pt-9 max-sm:pt-0 xl:pt-0"
    >
      <PrimaryPageTitlebar visible={visible} />
      <div className={cn('sm:px-4 pb-4 pt-11 xl:pt-4', isMacOS() ? 'max-sm:pt-20' : '')}>
        {children}
      </div>
      <ScrollToTopButton scrollAreaRef={scrollAreaRef} visible={visible} />
    </ScrollArea>
  )
})
PrimaryPageLayout.displayName = 'PrimaryPageLayout'
export default PrimaryPageLayout

export type TPrimaryPageLayoutRef = {
  scrollToTop: () => void
}

function PrimaryPageTitlebar({ visible = true }: { visible?: boolean }) {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Titlebar
        className="justify-between px-4 transition-transform duration-500"
        visible={visible}
      >
        <div className="flex gap-1 items-center">
          <div className="-translate-y-0.5">
            <Logo className="h-8" />
          </div>
          <ThemeToggle variant="small-screen-titlebar" />
        </div>
        <div className="flex gap-1 items-center">
          <SearchButton variant="small-screen-titlebar" />
          <PostButton variant="small-screen-titlebar" />
          <RelaySettingsButton variant="small-screen-titlebar" />
          <AccountButton variant="small-screen-titlebar" />
        </div>
      </Titlebar>
    )
  }

  return (
    <Titlebar className={`justify-between xl:hidden ${isMacOS() ? 'pl-20' : ''}`}>
      <div className="flex gap-2 items-center">
        <AccountButton />
        <PostButton />
        <SearchButton />
      </div>
      <div className="flex gap-2 items-center">
        <RefreshButton />
        <RelaySettingsButton />
      </div>
    </Titlebar>
  )
}
