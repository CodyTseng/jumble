import BackButton from '@/components/BackButton'
import BottomNavigationBar from '@/components/BottomNavigationBar'
import ScrollToTopButton from '@/components/ScrollToTopButton'
import { Titlebar } from '@/components/Titlebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSecondaryPage } from '@/PageManager'
import { DeepBrowsingProvider } from '@/providers/DeepBrowsingProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

const SecondaryPageLayout = forwardRef(
  (
    {
      children,
      index,
      title,
      controls,
      hideBackButton = false,
      displayScrollToTopButton = false
    }: {
      children?: React.ReactNode
      index?: number
      title?: React.ReactNode
      controls?: React.ReactNode
      hideBackButton?: boolean
      displayScrollToTopButton?: boolean
    },
    ref
  ) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const { isSmallScreen } = useScreenSize()
    const { currentIndex } = useSecondaryPage()

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
    }, [])

    if (isSmallScreen) {
      return (
        <DeepBrowsingProvider active={currentIndex === index}>
          <div
            style={{
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 3rem)'
            }}
          >
            <SecondaryPageTitlebar
              title={title}
              controls={controls}
              hideBackButton={hideBackButton}
            />
            {children}
            <BottomNavigationBar />
          </div>
          {displayScrollToTopButton && <ScrollToTopButton />}
        </DeepBrowsingProvider>
      )
    }

    return (
      <DeepBrowsingProvider active={currentIndex === index} scrollAreaRef={scrollAreaRef}>
        <ScrollArea
          className="h-screen overflow-auto"
          scrollBarClassName="z-50 pt-12"
          ref={scrollAreaRef}
        >
          <SecondaryPageTitlebar
            title={title}
            controls={controls}
            hideBackButton={hideBackButton}
          />
          {children}
          <div className="h-4" />
        </ScrollArea>
        {displayScrollToTopButton && <ScrollToTopButton scrollAreaRef={scrollAreaRef} />}
      </DeepBrowsingProvider>
    )
  }
)
SecondaryPageLayout.displayName = 'SecondaryPageLayout'
export default SecondaryPageLayout

export function SecondaryPageTitlebar({
  title,
  controls,
  hideBackButton = false
}: {
  title?: React.ReactNode
  controls?: React.ReactNode
  hideBackButton?: boolean
}): JSX.Element {
  return (
    <Titlebar className="h-12 flex gap-1 p-1 items-center justify-between font-semibold">
      {hideBackButton ? (
        <div className="flex gap-2 items-center pl-3 w-fit truncate text-lg font-semibold">
          {title}
        </div>
      ) : (
        <div className="flex items-center flex-1 w-0">
          <BackButton>{title}</BackButton>
        </div>
      )}
      <div className="flex-shrink-0">{controls}</div>
    </Titlebar>
  )
}
