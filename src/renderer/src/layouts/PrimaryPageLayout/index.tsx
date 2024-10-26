import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { isMacOS } from '@renderer/lib/platform'
import { Titlebar } from '../../components/Titlebar'

export default function PrimaryPageLayout({
  children,
  titlebarContent
}: {
  children: React.ReactNode
  titlebarContent?: React.ReactNode
}) {
  return (
    <ScrollArea className="h-full" scrollBarClassName={isMacOS() ? 'pt-9' : 'pt-4'}>
      <PrimaryPageTitlebar content={titlebarContent} />
      <div className="px-4 pb-4 pt-[52px]">{children}</div>
    </ScrollArea>
  )
}

export function PrimaryPageTitlebar({ content }: { content?: React.ReactNode }) {
  return <Titlebar className={isMacOS() ? 'pl-20' : ''}>{content}</Titlebar>
}
