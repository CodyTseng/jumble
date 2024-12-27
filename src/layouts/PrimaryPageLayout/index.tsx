import Logo from '@/assets/Logo'
import AccountButton from '@/components/AccountButton'
import NotificationButton from '@/components/NotificationButton'
import PostButton from '@/components/PostButton'
import RelaySettingsButton from '@/components/RelaySettingsButton'
import ScrollToTopButton from '@/components/ScrollToTopButton'
import SearchButton from '@/components/SearchButton'
import ThemeToggle from '@/components/ThemeToggle'
import { Titlebar } from '@/components/Titlebar'
import { usePrimaryPage } from '@/PageManager'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const PrimaryPageLayout = forwardRef(({ children }: { children?: React.ReactNode }, ref) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(true)
  const [lastScrollTop, setLastScrollTop] = useState(0)
  const { isSmallScreen } = useScreenSize()
  const { active } = usePrimaryPage()

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: () => {
        if (isSmallScreen) {
          window.scrollTo({ top: 0 })
          return
        }
        scrollAreaRef.current?.scrollTo({ top: 0 })
      }
    }),
    []
  )

  useEffect(() => {
    if (!active) return

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
  }, [lastScrollTop, isSmallScreen, active])

  return (
    <div className="sm:h-screen sm:overflow-auto" ref={scrollAreaRef}>
      <PrimaryPageTitlebar visible={visible} />
      <div className="sm:px-4 pb-4 sm:pt-4">{children}</div>
      <ScrollToTopButton scrollAreaRef={scrollAreaRef} visible={visible && lastScrollTop > 500} />
    </div>
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
        className="h-11 flex gap-1 justify-between px-4 items-center font-semibold"
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
          <NotificationButton variant="small-screen-titlebar" />
          <AccountButton variant="small-screen-titlebar" />
        </div>
      </Titlebar>
    )
  }

  return (
    <Titlebar className="h-9 flex gap-1 px-2 justify-between xl:hidden items-center font-semibold">
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
