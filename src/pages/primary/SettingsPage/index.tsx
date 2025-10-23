import Settings from '@/components/Settings'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { TPageRef } from '@/types'
import { SettingsIcon } from 'lucide-react'
import { forwardRef, useImperativeHandle, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const SettingsPage = forwardRef((_, ref) => {
  const layoutRef = useRef<TPageRef>(null)
  useImperativeHandle(ref, () => layoutRef.current)

  return (
    <PrimaryPageLayout
      pageName="settings"
      ref={layoutRef}
      titlebar={<SettingsPageTitlebar />}
      displayScrollToTopButton
    >
      <Settings />
    </PrimaryPageLayout>
  )
})
SettingsPage.displayName = 'SettingsPage'
export default SettingsPage

function SettingsPageTitlebar() {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2 items-center h-full pl-3">
      <SettingsIcon />
      <div className="text-lg font-semibold">{t('Settings')}</div>
    </div>
  )
}
