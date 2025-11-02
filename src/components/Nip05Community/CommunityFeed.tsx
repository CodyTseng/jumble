import NoteList from '@/components/NoteList'
import { useKindFilter } from '@/providers/KindFilterProvider'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { useEffect, useState } from 'react'
import { RefreshButton } from '../RefreshButton'
import KindFilter from '../KindFilter'
import { Skeleton } from '../ui/skeleton'

export default function CommunityFeed({ domain, topSpace }: { domain: string; topSpace: number }) {
  const { pubkey } = useNostr()
  const { showKinds, updateShowKinds } = useKindFilter()
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      try {
        // Generate subscription requests for this domain community
        const requests = await client.generateSubRequestsForDomain(domain, pubkey)
        setSubRequests(requests)
      } catch (error) {
        console.error('Error generating community feed requests:', error)
        setSubRequests([])
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [domain, pubkey])

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-24 mb-2" />
        <Skeleton className="h-24 mb-2" />
        <Skeleton className="h-24 mb-2" />
      </div>
    )
  }

  if (subRequests.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No members found for this community
      </div>
    )
  }

  return (
    <>
      <div
        className="sticky bg-background z-20 flex justify-between items-center px-4 py-2 border-b"
        style={{ top: `${topSpace}px` }}
      >
        <KindFilter showKinds={showKinds} onShowKindsChange={updateShowKinds} />
        <RefreshButton onClick={() => window.location.reload()} />
      </div>
      <NoteList
        subRequests={subRequests}
        showKinds={showKinds}
        filterMutedNotes
        hideUntrustedNotes
      />
    </>
  )
}
