import ScrollToTopButton from '@renderer/components/ScrollToTopButton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { isMacOS } from '@renderer/lib/platform'
import { useSecondaryPage } from '@renderer/PageManager'
import { ChevronLeft } from 'lucide-react'
import { useRef } from 'react'
import { Titlebar, TitlebarButton } from '../../components/Titlebar'

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
      <div className="px-4 pb-4 pt-[52px]">{children}</div>
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
  const { pop } = useSecondaryPage()

  return (
    <Titlebar className="pl-1">
      {!hideBackButton && (
        <TitlebarButton onClick={() => pop()}>
          <ChevronLeft className="text-foreground" size={18} />
        </TitlebarButton>
      )}
      <div>{content}</div>
    </Titlebar>
  )
}
