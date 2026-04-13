import Settings from '@/components/Settings'
import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { TPageRef } from '@/types'
import { SettingsIcon } from 'lucide-react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const SettingsPage = forwardRef<TPageRef>((_, ref) => {
  const { t } = useTranslation()
  return (
    <PrimaryPageLayout
      pageName="settings"
      ref={ref}
      icon={<SettingsIcon />}
      title={t('Settings')}
      displayScrollToTopButton
    >
      <Settings />
    </PrimaryPageLayout>
  )
})
SettingsPage.displayName = 'SettingsPage'
export default SettingsPage
