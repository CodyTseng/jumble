import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'

export default function HomePage() {
  return (
    <SecondaryPageLayout hideBackButton>
      <div className="text-muted-foreground w-full h-full flex items-center justify-center">
        Welcome! 🥳
      </div>
    </SecondaryPageLayout>
  )
}
