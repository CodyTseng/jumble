import ScrollToTopButton from '@renderer/components/ScrollToTopButton'
import { Titlebar } from '@renderer/components/Titlebar'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { isMacOS } from '@renderer/lib/env'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import AccountButton from './AccountButton'
import PostButton from './PostButton'
import RefreshButton from './RefreshButton'
import RelaySettingsPopover from './RelaySettingsPopover'

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
      <ScrollArea ref={scrollAreaRef} className="h-full" scrollBarClassName="pt-9">
        <PrimaryPageTitlebar content={titlebarContent} />
        <div className="px-4 pb-4 pt-11">{children}</div>
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
    <Titlebar className={`justify-between ${isMacOS() ? 'pl-20' : ''}`}>
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
