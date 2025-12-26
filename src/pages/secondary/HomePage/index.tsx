import { forwardRef } from 'react'
import ActiveCommunityMembers from './ActiveCommunityMembers'

const HomePage = forwardRef(({ index }: { index?: number }, ref) => {
  console.log('[HomePage] RENDER')

  // Always show Active Community Members as the default secondary page
  return <ActiveCommunityMembers ref={ref} index={index} />
})
HomePage.displayName = 'HomePage'
export default HomePage
