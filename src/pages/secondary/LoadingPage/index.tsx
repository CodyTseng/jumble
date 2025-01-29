import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'

const LoadingPage = forwardRef(({ title, index }: { title?: string; index?: number }, ref) => {
  return (
    <SecondaryPageLayout ref={ref} index={index} title={title}>
      <div className="text-muted-foreground text-center">
        <div>Loading...</div>
      </div>
    </SecondaryPageLayout>
  )
})
LoadingPage.displayName = 'LoadingPage'
export default LoadingPage
