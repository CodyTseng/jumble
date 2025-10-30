import ScrollToTopButton from '@/components/ScrollToTopButton'
import { Titlebar } from '@/components/Titlebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TPrimaryPageName, usePrimaryPage } from '@/PageManager'
import { DeepBrowsingProvider } from '@/providers/DeepBrowsingProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const PrimaryPageLayout = forwardRef(
  (
    {
      children,
      titlebar,
      pageName,
      displayScrollToTopButton = false,
      hideTitlebarBottomBorder = false
    }: {
      children?: React.ReactNode
      titlebar: React.ReactNode
      pageName: TPrimaryPageName
      displayScrollToTopButton?: boolean
      hideTitlebarBottomBorder?: boolean
    },
    ref
  ) => {
    const { pubkey } = useNostr()
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const smallScreenScrollAreaRef = useRef<HTMLDivElement>(null)
    const smallScreenLastScrollTopRef = useRef(0)
    const { enableSingleColumnLayout } = useUserPreferences()
    const { current, display } = usePrimaryPage()

    useImperativeHandle(
      ref,
      () => ({
        scrollToTop: (behavior: ScrollBehavior = 'smooth') => {
          setTimeout(() => {
            if (scrollAreaRef.current) {
              return scrollAreaRef.current.scrollTo({ top: 0, behavior })
            }
            window.scrollTo({ top: 0, behavior })
          }, 10)
        }
      }),
      []
    )

    useEffect(() => {
      if (!enableSingleColumnLayout) return

      const isVisible = () => {
        return smallScreenScrollAreaRef.current?.checkVisibility
          ? smallScreenScrollAreaRef.current?.checkVisibility()
          : false
      }

      if (isVisible()) {
        window.scrollTo({ top: smallScreenLastScrollTopRef.current, behavior: 'instant' })
      }
      const handleScroll = () => {
        if (isVisible()) {
          smallScreenLastScrollTopRef.current = window.scrollY
        }
      }
      window.addEventListener('scroll', handleScroll)
      return () => {
        window.removeEventListener('scroll', handleScroll)
      }
    }, [current, enableSingleColumnLayout, display])

    useEffect(() => {
      smallScreenLastScrollTopRef.current = 0
    }, [pubkey])

    if (enableSingleColumnLayout) {
      return (
        <DeepBrowsingProvider active={current === pageName && display}>
          <div
            ref={smallScreenScrollAreaRef}
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 3rem)'
            }}
          >
            <PrimaryPageTitlebar hideBottomBorder={hideTitlebarBottomBorder}>
              {titlebar}
            </PrimaryPageTitlebar>
            {children}
          </div>
          {displayScrollToTopButton && <ScrollToTopButton />}
        </DeepBrowsingProvider>
      )
    }

    return (
      <DeepBrowsingProvider active={current === pageName && display} scrollAreaRef={scrollAreaRef}>
        <ScrollArea
          className="h-full overflow-auto"
          scrollBarClassName="z-50 pt-12"
          ref={scrollAreaRef}
        >
          <PrimaryPageTitlebar hideBottomBorder={hideTitlebarBottomBorder}>
            {titlebar}
          </PrimaryPageTitlebar>
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
  scrollToTop: (behavior?: ScrollBehavior) => void
}

function PrimaryPageTitlebar({
  children,
  hideBottomBorder = false
}: {
  children?: React.ReactNode
  hideBottomBorder?: boolean
}) {
  return (
    <Titlebar className="p-1" hideBottomBorder={hideBottomBorder}>
      {children}
    </Titlebar>
  )
}
