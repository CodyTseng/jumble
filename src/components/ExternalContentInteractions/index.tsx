import Tabs from '@/components/Tabs'
import { SPECIAL_FEED_ID } from '@/constants'
import { useState } from 'react'
import QuoteList from '../QuoteList'
import ReactionList from '../ReactionList'
import ReplyNoteList from '../ReplyNoteList'
import TrustScoreFilter from '../TrustScoreFilter'

type TTabValue = 'replies' | 'reactions' | 'quotes'

const TABS = [
  { value: 'replies', label: 'Replies' },
  { value: 'reactions', label: 'Reactions' },
  { value: 'quotes', label: 'Quotes' }
]

export default function ExternalContentInteractions({
  externalContent
}: {
  externalContent: string
}) {
  const [type, setType] = useState<TTabValue>('replies')
  let list
  switch (type) {
    case 'replies':
      list = <ReplyNoteList stuff={externalContent} />
      break
    case 'reactions':
      list = <ReactionList stuff={externalContent} />
      break
    case 'quotes':
      list = <QuoteList stuff={externalContent} />
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
