import BottomNavigationBar from '@/components/BottomNavigationBar'
import ScrollToTopButton from '@/components/ScrollToTopButton'
import { Titlebar } from '@/components/Titlebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TPrimaryPageName, usePrimaryPage } from '@/PageManager'
import { DeepBrowsingProvider } from '@/providers/DeepBrowsingProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const PrimaryPageLayout = forwardRef(
  (
    {
      children,
      titlebar,
      pageName,
      displayScrollToTopButton = false
    }: {
      children?: React.ReactNode
      titlebar: React.ReactNode
      pageName: TPrimaryPageName
      displayScrollToTopButton?: boolean
    },
    ref
  ) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const smallScreenScrollAreaRef = useRef<HTMLDivElement>(null)
    const smallScreenLastScrollTopRef = useRef(0)
    const { isSmallScreen } = useScreenSize()
    const { current, display } = usePrimaryPage()

    useImperativeHandle(
      ref,
      () => ({
        scrollToTop: () => {
          if (scrollAreaRef.current) {
            return scrollAreaRef.current.scrollTo({ top: 0, behavior: 'smooth' })
          }
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }
      }),
      []
    )

    useEffect(() => {
      if (isSmallScreen) {
        if (smallScreenScrollAreaRef.current?.checkVisibility()) {
          window.scrollTo({ top: smallScreenLastScrollTopRef.current, behavior: 'instant' })
        }
        const handleScroll = () => {
          if (smallScreenScrollAreaRef.current?.checkVisibility()) {
            smallScreenLastScrollTopRef.current = window.scrollY
          }
        }
        window.addEventListener('scroll', handleScroll)
        return () => {
          window.removeEventListener('scroll', handleScroll)
        }
      }
    }, [current, isSmallScreen, display])

    if (isSmallScreen) {
      return (
        <DeepBrowsingProvider active={current === pageName}>
          <div
            ref={smallScreenScrollAreaRef}
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 3rem)'
            }}
          >
            <PrimaryPageTitlebar>{titlebar}</PrimaryPageTitlebar>
            {children}
            <BottomNavigationBar />
          </div>
          {displayScrollToTopButton && <ScrollToTopButton />}
        </DeepBrowsingProvider>
      )
    }

    return (
      <DeepBrowsingProvider active={current === pageName} scrollAreaRef={scrollAreaRef}>
        <ScrollArea
          className="h-screen overflow-auto"
          scrollBarClassName="z-50 pt-12"
          ref={scrollAreaRef}
        >
          <PrimaryPageTitlebar>{titlebar}</PrimaryPageTitlebar>
          {children}
          <div className="h-4" />
        </ScrollArea>
        {displayScrollToTopButton && <ScrollToTopButton scrollAreaRef={scrollAreaRef} />}
      </DeepBrowsingProvider>
    )
  }
)
PrimaryPageLayout.displayName = 'PrimaryPageLayout'
export default PrimaryPageLayout

export type TPrimaryPageLayoutRef = {
  scrollToTop: () => void
}

function PrimaryPageTitlebar({ children }: { children?: React.ReactNode }) {
  return <Titlebar className="p-1">{children}</Titlebar>
}
