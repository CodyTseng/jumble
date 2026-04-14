import MeDrawerContent from '@/components/MeDrawer/MeDrawerContent'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { TPageRef } from '@/types'
import { forwardRef } from 'react'

const MePage = forwardRef<TPageRef>((_, ref) => {
  return (
    <PrimaryPageLayout ref={ref} pageName="home" titlebar={<div />} hideTitlebarBottomBorder>
      <MeDrawerContent />
    </PrimaryPageLayout>
  )
})
MePage.displayName = 'MePage'
export default MePage
