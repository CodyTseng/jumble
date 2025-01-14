import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'

export default function LoadingPage({ title, index }: { title?: string; index?: number }) {
  return (
    <SecondaryPageLayout index={index} title={title}>
      <div className="text-muted-foreground text-center">
        <div>Loading...</div>
      </div>
    </SecondaryPageLayout>
  )
}
