import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import QuoteList from '../QuoteList'
import ReactionList from '../ReactionList'
import ReplyNoteList from '../ReplyNoteList'
import RepostList from '../RepostList'
import TrustScoreFilter from '../TrustScoreFilter'
import ZapList from '../ZapList'
import { Tabs, TTabValue } from './Tabs'

export default function NoteInteractions({ event }: { event: Event }) {
  const [type, setType] = useState<TTabValue>('replies')

  let list
  switch (type) {
    case 'replies':
      list = <ReplyNoteList stuff={event} />
      break
    case 'quotes':
      list = <QuoteList stuff={event} />
      break
    case 'reactions':
      list = <ReactionList stuff={event} />
      break
    case 'reposts':
      list = <RepostList event={event} />
      break
    case 'zaps':
      list = <ZapList event={event} />
      break
    default:
      break
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <ScrollArea className="flex-1 w-0">
          <Tabs selectedTab={type} onTabChange={setType} />
          <ScrollBar orientation="horizontal" className="opacity-0 pointer-events-none" />
        </ScrollArea>
        <Separator orientation="vertical" className="h-6" />
        <TrustScoreFilter />
      </div>
      <Separator />
      {list}
    </>
  )
}
