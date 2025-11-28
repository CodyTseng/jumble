import DivineVideoList from '@/components/DivineVideoList'
import { useUserTrust } from '@/providers/UserTrustProvider'

export default function DivineFeed() {
  const { hideUntrustedNotes } = useUserTrust()

  return (
    <DivineVideoList
      filterMutedNotes
      hideUntrustedNotes={hideUntrustedNotes}
    />
  )
}
