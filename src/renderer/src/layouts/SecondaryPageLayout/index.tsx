import BackButton from '@renderer/components/BackButton'
import ScrollToTopButton from '@renderer/components/ScrollToTopButton'
import ThemeToggle from '@renderer/components/ThemeToggle'
import { Titlebar } from '@renderer/components/Titlebar'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useRef } from 'react'

export default function SecondaryPageLayout({
  children,
  titlebarContent,
  hideBackButton = false
}: {
  children?: React.ReactNode
  titlebarContent?: React.ReactNode
  hideBackButton?: boolean
}): JSX.Element {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  return (
    <ScrollArea ref={scrollAreaRef} className="h-full" scrollBarClassName="pt-9">
      <SecondaryPageTitlebar content={titlebarContent} hideBackButton={hideBackButton} />
      <div className="px-4 pb-4 pt-11 w-full h-full">{children}</div>
      <ScrollToTopButton scrollAreaRef={scrollAreaRef} />
    </ScrollArea>
  )
}

export function SecondaryPageTitlebar({
  content,
  hideBackButton = false
}: {
  content?: React.ReactNode
  hideBackButton?: boolean
}): JSX.Element {
  return (
    <Titlebar className="justify-between">
      <div className="flex items-center gap-1 flex-1 w-0">
        <BackButton hide={hideBackButton} />
        <div className="truncate text-lg">{content}</div>
      </div>
      <div className="flex-shrink-0 flex items-center">
        <ThemeToggle />
      </div>
    </Titlebar>
  )
}
