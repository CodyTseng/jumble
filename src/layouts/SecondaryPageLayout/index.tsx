import ScrollToTopButton from '@/components/ScrollToTopButton'
import { Titlebar } from '@/components/Titlebar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useSecondaryPage } from '@/PageManager'
import { DeepBrowsingProvider } from '@/providers/DeepBrowsingProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ChevronLeft, X } from 'lucide-react'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const SecondaryPageLayout = forwardRef(
  (
    {
      children,
      index,
      title,
      controls,
      hideBackButton = false,
      hideTitlebarBottomBorder = false,
      displayScrollToTopButton = false,
      titlebar,
      showCloseButton = false,
      onClose,
      hideTitlebar = false
    }: {
      children?: React.ReactNode
      index?: number
      title?: React.ReactNode
      controls?: React.ReactNode
      hideBackButton?: boolean
      hideTitlebarBottomBorder?: boolean
      displayScrollToTopButton?: boolean
      titlebar?: React.ReactNode
      showCloseButton?: boolean
      onClose?: () => void
      hideTitlebar?: boolean
    },
    ref
  ) => {
    const scrollAreaRef = useRef<HTMLDivElement>(null)
    const { isSmallScreen } = useScreenSize()
    const { currentIndex } = useSecondaryPage()

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
      if (isSmallScreen) {
        setTimeout(() => window.scrollTo({ top: 0 }), 10)
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
            {!hideTitlebar && (
              <SecondaryPageTitlebar
                title={title}
                controls={controls}
                hideBackButton={hideBackButton}
                hideBottomBorder={hideTitlebarBottomBorder}
                titlebar={titlebar}
                showCloseButton={showCloseButton}
                onClose={onClose}
              />
            )}
            <main>
              {children}
            </main>
          </div>
          {displayScrollToTopButton && <ScrollToTopButton />}
        </DeepBrowsingProvider>
      )
    }

    return (
      <DeepBrowsingProvider active={currentIndex === index} scrollAreaRef={scrollAreaRef}>
        <ScrollArea
          className="h-full overflow-auto"
          scrollBarClassName="z-50 pt-12"
          ref={scrollAreaRef}
        >
          {!hideTitlebar && (
            <SecondaryPageTitlebar
              title={title}
              controls={controls}
              hideBackButton={hideBackButton}
              hideBottomBorder={hideTitlebarBottomBorder}
              titlebar={titlebar}
              showCloseButton={showCloseButton}
              onClose={onClose}
            />
          )}
          <main>
            {children}
          </main>
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
  hideBackButton = false,
  hideBottomBorder = false,
  titlebar,
  showCloseButton = false,
  onClose
}: {
  title?: React.ReactNode
  controls?: React.ReactNode
  hideBackButton?: boolean
  hideBottomBorder?: boolean
  titlebar?: React.ReactNode
  showCloseButton?: boolean
  onClose?: () => void
}): JSX.Element {
  const { isSmallScreen } = useScreenSize()

  if (titlebar) {
    return (
      <Titlebar className="p-1" hideBottomBorder={hideBottomBorder}>
        {titlebar}
      </Titlebar>
    )
  }
  return (
    <Titlebar
      className="flex gap-1 p-1 items-center justify-between font-semibold"
      hideBottomBorder={hideBottomBorder}
    >
      {hideBackButton ? (
        <div className="flex gap-2 items-center pl-3 w-fit truncate text-lg font-semibold" style={{ fontSize: `var(--title-font-size, 18px)` }}>
          {title}
        </div>
      ) : (
        <div className="flex items-center flex-1 w-0">
          <BackButton>{title}</BackButton>
        </div>
      )}
      <div className="flex-shrink-0 flex items-center gap-1">
        {controls}
        {(!isSmallScreen || showCloseButton) && <CloseButton onClose={onClose} />}
      </div>
    </Titlebar>
  )
}

function BackButton({ children }: { children?: React.ReactNode }) {
  const { t } = useTranslation()
  const { pop } = useSecondaryPage()

  return (
    <Button
      className="flex gap-1 items-center w-fit max-w-full justify-start pl-2 pr-3"
      variant="ghost"
      size="titlebar-icon"
      title={t('back')}
      onClick={() => pop()}
    >
      <ChevronLeft />
      <div className="truncate text-lg font-semibold" style={{ fontSize: `var(--title-font-size, 18px)` }}>{children}</div>
    </Button>
  )
}

function CloseButton({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation()
  const { clear } = useSecondaryPage()

  return (
    <Button
      variant="ghost"
      size="titlebar-icon"
      title={t('close')}
      onClick={() => {
        if (onClose) {
          onClose()
        } else {
          clear()
        }
      }}
    >
      <X />
    </Button>
  )
}
