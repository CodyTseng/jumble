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
      titlebar?: React.ReactNode
      pageName: TPrimaryPageName
      displayScrollToTopButton?: boolean
    },
    ref
  ) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const { isSmallScreen } = useScreenSize()
    const { current } = usePrimaryPage()

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
        window.scrollTo({ top: 0 })
        return
      }
    }, [current])

    if (isSmallScreen) {
      return (
        <DeepBrowsingProvider active={current === pageName}>
          <div
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 3rem)'
            }}
          >
            {titlebar && <PrimaryPageTitlebar>{titlebar}</PrimaryPageTitlebar>}
            {children}
            {displayScrollToTopButton && <ScrollToTopButton />}
            <BottomNavigationBar />
          </div>
        </DeepBrowsingProvider>
      )
    }

    return (
      <DeepBrowsingProvider active={current === pageName} scrollAreaRef={scrollAreaRef}>
        <ScrollArea
          className="h-screen overflow-auto"
          scrollBarClassName="z-50"
          ref={scrollAreaRef}
        >
          {titlebar && <PrimaryPageTitlebar>{titlebar}</PrimaryPageTitlebar>}
          {children}
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
  return <Titlebar className="h-12 p-1">{children}</Titlebar>
}
