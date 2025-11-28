import DivineVideoList from '@/components/DivineVideoList'
import Tabs from '@/components/Tabs'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { TPageRef } from '@/types'
import { Clapperboard } from 'lucide-react'
import { forwardRef, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TDivineTabs = 'discovery' | 'trending'

const DivinePage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  const { hideUntrustedNotes } = useUserTrust()
  const [tab, setTab] = useState<TDivineTabs>('discovery')
  const topRef = useRef<HTMLDivElement | null>(null)

  const content = useMemo(() => {
    return (
      <DivineVideoList
        hideUntrustedNotes={hideUntrustedNotes}
        filterMutedNotes
      />
    )
  }, [tab, hideUntrustedNotes])

  return (
    <PrimaryPageLayout
      ref={ref}
      pageName="divine"
      titlebar={<DivinePageTitlebar />}
      displayScrollToTopButton
    >
      <Tabs
        value={tab}
        tabs={[
          { value: 'discovery', label: 'Discovery' },
          { value: 'trending', label: 'Trending' }
        ]}
        onTabChange={(tab) => {
          setTab(tab as TDivineTabs)
          topRef.current?.scrollIntoView({ behavior: 'instant' })
        }}
      />
      <div ref={topRef} className="scroll-mt-[calc(6rem+1px)]" />
      {content}
    </PrimaryPageLayout>
  )
})

DivinePage.displayName = 'DivinePage'
export default DivinePage

function DivinePageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 justify-between h-full">
      <div className="flex gap-2 items-center h-full pl-3">
        <Clapperboard />
        <div className="text-lg font-semibold">{t('Divine Videos')}</div>
      </div>
    </div>
  )
}
