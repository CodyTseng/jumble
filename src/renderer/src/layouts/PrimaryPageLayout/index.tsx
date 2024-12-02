import AccountButton from '@renderer/components/AccountButton'
import PostButton from '@renderer/components/PostButton'
import RefreshButton from '@renderer/components/RefreshButton'
import RelaySettingsButton from '@renderer/components/RelaySettingsButton'
import ScrollToTopButton from '@renderer/components/ScrollToTopButton'
import SearchButton from '@renderer/components/SearchButton'
import { Titlebar } from '@renderer/components/Titlebar'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { isMacOS } from '@renderer/lib/env'
import { cn } from '@renderer/lib/utils'
import { useScreenSize } from '@renderer/providers/ScreenSizeProvider'
import { forwardRef, useImperativeHandle, useRef } from 'react'

const PrimaryPageLayout = forwardRef(({ children }: { children?: React.ReactNode }, ref) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(
    ref,
    () => ({
      scrollToTop: () => {
        scrollAreaRef.current?.scrollTo({ top: 0 })
      }
    }),
    []
  )

  return (
    <ScrollArea
      ref={scrollAreaRef}
      className="h-full w-full"
      scrollBarClassName="pt-9 max-sm:pt-0 xl:pt-0"
    >
      <PrimaryPageTitlebar />
      <div className={cn('sm:px-4 pb-4 pt-11 xl:pt-4', isMacOS() ? 'max-sm:pt-20' : 'max-sm:pt-9')}>
        {children}
      </div>
      <ScrollToTopButton scrollAreaRef={scrollAreaRef} />
    </ScrollArea>
  )
})
PrimaryPageLayout.displayName = 'PrimaryPageLayout'
export default PrimaryPageLayout

export type TPrimaryPageLayoutRef = {
  scrollToTop: () => void
}

function PrimaryPageTitlebar() {
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Titlebar className="justify-between px-4">
        <div className="text-2xl font-extrabold font-mono">Jumble</div>
        <div className="flex gap-2 items-center">
          <SearchButton />
          <PostButton />
          <RelaySettingsButton />
          <AccountButton />
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
