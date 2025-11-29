import DivineVideoList from '@/components/DivineVideoList'
import Tabs from '@/components/Tabs'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { DivineSortMode } from '@/lib/divine-video'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { TPageRef } from '@/types'
import { Clapperboard } from 'lucide-react'
import { forwardRef, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Tab configuration for Divine Videos page
 * Each tab uses a NIP-50 sort mode for different content discovery:
 * - hot: Recent videos with high engagement (Discovery)
 * - top: Classic archived Vines sorted by popularity (Classic)
 * - rising: Videos gaining traction quickly (Rising)
 * - new: Most recent videos (no sort mode, chronological)
 */
type TDivineTabs = 'hot' | 'top' | 'rising' | 'new'

const TAB_SORT_MODES: Record<TDivineTabs, DivineSortMode | undefined> = {
  hot: 'hot',
  top: 'top',
  rising: 'rising',
  new: undefined // Chronological order, no NIP-50 sort
}

const DivinePage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  const { hideUntrustedNotes } = useUserTrust()
  const [tab, setTab] = useState<TDivineTabs>('hot')
  const topRef = useRef<HTMLDivElement | null>(null)

  const content = useMemo(() => {
    return (
      <DivineVideoList
        key={tab} // Force remount when tab changes to reset state
        hideUntrustedNotes={hideUntrustedNotes}
        filterMutedNotes
        sortMode={TAB_SORT_MODES[tab]}
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
          { value: 'hot', label: 'Hot' },
          { value: 'top', label: 'Classic' },
          { value: 'rising', label: 'Rising' },
          { value: 'new', label: 'New' }
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
        <div className="text-lg font-semibold">{t('diVine Videos')}</div>
      </div>
    </div>
  )
}
