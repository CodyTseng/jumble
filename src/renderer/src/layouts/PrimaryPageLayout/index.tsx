import ScrollToTopButton from '@renderer/components/ScrollToTopButton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { isMacOS } from '@renderer/lib/platform'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { Titlebar } from '../../components/Titlebar'

const PrimaryPageLayout = forwardRef(
  (
    { children, titlebarContent }: { children: React.ReactNode; titlebarContent: React.ReactNode },
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
      <ScrollArea
        ref={scrollAreaRef}
        className="h-full"
        scrollBarClassName={isMacOS() ? 'pt-9' : 'pt-4'}
      >
        <PrimaryPageTitlebar content={titlebarContent} />
        <div className="px-4 pb-4 pt-[52px]">{children}</div>
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
  return <Titlebar className={isMacOS() ? 'pl-20' : ''}>{content}</Titlebar>
}
