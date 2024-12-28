import ScrollToTopButton from '@/components/ScrollToTopButton'
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
      <div className="pb-4">{children}</div>
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
  return null
}
