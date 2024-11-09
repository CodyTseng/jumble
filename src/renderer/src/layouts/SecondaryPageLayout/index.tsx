import ScrollToTopButton from '@renderer/components/ScrollToTopButton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { isMacOS } from '@renderer/lib/platform'
import { useRef } from 'react'
import { Titlebar } from '../../components/Titlebar'
import BackButton from './BackButton'
import ThemeToggle from './ThemeToggle'

export default function SecondaryPageLayout({
  children,
  titlebarContent,
  hideBackButton = false
}: {
  children: React.ReactNode
  titlebarContent?: React.ReactNode
  hideBackButton?: boolean
}): JSX.Element {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  return (
    <ScrollArea
      ref={scrollAreaRef}
      className="h-full"
      scrollBarClassName={isMacOS() ? 'pt-9' : 'pt-4'}
    >
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
      <div className="flex items-center gap-2 flex-1 w-0">
        <BackButton hide={hideBackButton} />
        <div className="truncate">{content}</div>
      </div>
      <div className="flex-shrink-0 flex items-center">
        <ThemeToggle />
      </div>
    </Titlebar>
  )
}
