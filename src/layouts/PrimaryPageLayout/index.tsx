import Logo from '@/assets/Logo'
import AccountButton from '@/components/AccountButton'
import NotificationButton from '@/components/NotificationButton'
import PostButton from '@/components/PostButton'
import RelaySettingsButton from '@/components/RelaySettingsButton'
import ScrollToTopButton from '@/components/ScrollToTopButton'
import SearchButton from '@/components/SearchButton'
import ThemeToggle from '@/components/ThemeToggle'
import { Titlebar } from '@/components/Titlebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChristmas } from '@/providers/ChristmasProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
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
      scrollBarClassName="pt-9 xl:pt-0 max-sm:pt-11"
    >
      <PrimaryPageTitlebar visible={visible} />
      <div className="sm:px-4 pb-4 pt-11 xl:pt-4">{children}</div>
      <ScrollToTopButton scrollAreaRef={scrollAreaRef} visible={visible && lastScrollTop > 500} />
    </ScrollArea>
  )
})
PrimaryPageLayout.displayName = 'PrimaryPageLayout'
export default PrimaryPageLayout

export type TPrimaryPageLayoutRef = {
  scrollToTop: () => void
}

function PrimaryPageTitlebar({ visible = true }: { visible?: boolean }) {
  const { toggle } = useChristmas()
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Titlebar
        className="justify-between px-4 transition-transform duration-500"
        visible={visible}
      >
        <div className="flex gap-1 items-center">
          <div className="-translate-y-0.5 cursor-pointer" onClick={toggle}>
            <Logo className="h-8" />
          </div>
          <ThemeToggle variant="small-screen-titlebar" />
        </div>
        <div className="flex gap-1 items-center">
          <SearchButton variant="small-screen-titlebar" />
          <PostButton variant="small-screen-titlebar" />
          <RelaySettingsButton variant="small-screen-titlebar" />
          <NotificationButton variant="small-screen-titlebar" />
          <AccountButton variant="small-screen-titlebar" />
        </div>
      </Titlebar>
    )
  }

  return (
    <Titlebar className="justify-between xl:hidden">
      <div className="flex gap-2 items-center">
        <AccountButton />
        <PostButton />
        <SearchButton />
      </div>
      <div className="flex gap-2 items-center">
        <RelaySettingsButton />
        <NotificationButton />
      </div>
    </Titlebar>
  )
}
