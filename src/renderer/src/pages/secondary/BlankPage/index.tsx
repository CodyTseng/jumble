import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'

export default function BlankPage() {
  return (
    <SecondaryPageLayout hideBackButton>
      <div className="text-center text-muted-foreground">Welcome!</div>
    </SecondaryPageLayout>
  )
}
