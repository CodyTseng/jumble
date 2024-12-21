import Tree from '@/assets/christmas/tree.png'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useChristmas } from '@/providers/ChristmasProvider'
import { useTranslation } from 'react-i18next'

export default function HomePage() {
  const { t } = useTranslation()
  const { enabled } = useChristmas()

  return (
    <SecondaryPageLayout hideBackButton hideScrollToTopButton>
      {enabled ? (
        <div className="h-screen flex flex-col justify-center items-center">
          <img src={Tree} alt="Wreath" className="w-36 h-36" />
        </div>
      ) : (
        <div className="text-muted-foreground w-full h-full flex items-center justify-center">
          {t('Welcome! 🥳')}
        </div>
      )}
    </SecondaryPageLayout>
  )
}
