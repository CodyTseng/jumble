import BottomNavigationBar from '@/components/BottomNavigationBar'
import ScrollToTopButton from '@/components/ScrollToTopButton'
import { Titlebar } from '@/components/Titlebar'
import { TPrimaryPageName, usePrimaryPage } from '@/PageManager'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

const PrimaryPageLayout = forwardRef(
  (
    {
      children,
      titlebar,
      pageName
    }: { children?: React.ReactNode; titlebar?: React.ReactNode; pageName: TPrimaryPageName },
    ref
  ) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const [visible, setVisible] = useState(true)
    const [lastScrollTop, setLastScrollTop] = useState(0)
    const { isSmallScreen } = useScreenSize()
    const { current } = usePrimaryPage()

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
      if (isSmallScreen) {
        window.scrollTo({ top: 0 })
        setVisible(true)
        return
      }
    }, [current])

    useEffect(() => {
      if (current !== pageName) return

      const handleScroll = () => {
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
    }, [lastScrollTop, isSmallScreen, current])

    return (
      <div
        className="sm:h-screen sm:overflow-auto"
        ref={scrollAreaRef}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
      >
        {titlebar && (
          <PrimaryPageTitlebar visible={!isSmallScreen || visible}>{titlebar}</PrimaryPageTitlebar>
        )}
        <div className="overflow-x-hidden">{children}</div>
        <ScrollToTopButton scrollAreaRef={scrollAreaRef} visible={visible && lastScrollTop > 500} />
        {isSmallScreen && <BottomNavigationBar visible={visible} />}
      </div>
    )
  }
)
PrimaryPageLayout.displayName = 'PrimaryPageLayout'
export default PrimaryPageLayout

export type TPrimaryPageLayoutRef = {
  scrollToTop: () => void
}

function PrimaryPageTitlebar({
  children,
  visible = true
}: {
  children?: React.ReactNode
  visible?: boolean
}) {
  return (
    <Titlebar className="h-12 p-1" visible={visible}>
      {children}
    </Titlebar>
  )
}
