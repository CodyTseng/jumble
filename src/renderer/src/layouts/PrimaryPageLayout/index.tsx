import AccountButton from '@renderer/components/AccountButton'
import PostButton from '@renderer/components/PostButton'
import RefreshButton from '@renderer/components/RefreshButton'
import RelaySettingsPopover from '@renderer/components/RelaySettingsPopover'
import ScrollToTopButton from '@renderer/components/ScrollToTopButton'
import { Titlebar } from '@renderer/components/Titlebar'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { isMacOS } from '@renderer/lib/env'
import { forwardRef, useImperativeHandle, useRef } from 'react'

const PrimaryPageLayout = forwardRef(
  (
    { children, titlebarContent }: { children: React.ReactNode; titlebarContent?: React.ReactNode },
    ref
  ) => {
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
      <ScrollArea ref={scrollAreaRef} className="h-full w-full" scrollBarClassName="pt-9 xl:pt-0">
        <PrimaryPageTitlebar content={titlebarContent} />
        <div className="px-4 pb-4 pt-11 xl:pt-4">{children}</div>
        <ScrollToTopButton scrollAreaRef={scrollAreaRef} />
      </ScrollArea>
    )
  }
)
PrimaryPageLayout.displayName = 'PrimaryPageLayout'
export default PrimaryPageLayout

export type TPrimaryPageLayoutRef = {
  scrollToTop: () => void
}

export function PrimaryPageTitlebar({ content }: { content?: React.ReactNode }) {
  return (
    <Titlebar className={`justify-between xl:hidden ${isMacOS() ? 'pl-20' : ''}`}>
      <div className="flex gap-2 items-center">
        <AccountButton />
        <PostButton />
        {content}
      </div>
      <div className="flex gap-2 items-center">
        <RefreshButton />
        <RelaySettingsPopover />
      </div>
    </Titlebar>
  )
}
