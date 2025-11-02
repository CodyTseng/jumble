import Nip05Community from '@/components/Nip05Community'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'

const Nip05CommunityPage = forwardRef(
  ({ domain, index }: { domain?: string; index?: number }, ref) => {
    return (
      <SecondaryPageLayout
        index={index}
        title={domain || 'Community'}
        displayScrollToTopButton
        ref={ref}
      >
        <Nip05Community domain={domain} />
      </SecondaryPageLayout>
    )
  }
)
Nip05CommunityPage.displayName = 'Nip05CommunityPage'
export default Nip05CommunityPage
