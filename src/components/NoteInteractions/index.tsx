import Tabs from '@/components/Tabs'
import { SPECIAL_FEED_ID } from '@/constants'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import QuoteList from '../QuoteList'
import ReactionList from '../ReactionList'
import ReplyNoteList from '../ReplyNoteList'
import RepostList from '../RepostList'
import TrustScoreFilter from '../TrustScoreFilter'
import ZapList from '../ZapList'

type TTabValue = 'replies' | 'quotes' | 'reactions' | 'reposts' | 'zaps'

const TABS = [
  { value: 'replies', label: 'Replies' },
  { value: 'zaps', label: 'Zaps' },
  { value: 'reposts', label: 'Reposts' },
  { value: 'reactions', label: 'Reactions' },
  { value: 'quotes', label: 'Quotes' }
]

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
      <Tabs
        tabs={TABS}
        value={type}
        onTabChange={(tab) => setType(tab as TTabValue)}
        options={
          <TrustScoreFilter filterId={SPECIAL_FEED_ID.INTERACTIONS} />
        }
      />
      {list}
    </>
  )
}
