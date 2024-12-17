import Tree from '@renderer/assets/christmas/tree.png'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'

export default function HomePage() {
  return (
    <SecondaryPageLayout hideBackButton hideScrollToTopButton>
      <div className="h-full flex flex-col justify-center items-center">
        <img src={Tree} alt="Wreath" className="w-36 h-36" />
      </div>
    </SecondaryPageLayout>
  )
}
