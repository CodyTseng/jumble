import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'

export default function LoadingPage({ title }: { title?: string }) {
  return (
    <SecondaryPageLayout titlebarContent={title}>
      <div className="text-muted-foreground text-center">
        <div>Loading...</div>
      </div>
    </SecondaryPageLayout>
  )
}
