import Logo from '@/assets/Logo'
import { Button } from '@/components/ui/button'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AboutInfoDialog from '../AboutInfoDialog'
import AccountButton from '../AccountButton'
import NotificationButton from '../NotificationButton'
import PostButton from '../PostButton'
import RelaySettingsButton from '../RelaySettingsButton'
import SearchButton from '../SearchButton'

export default function PrimaryPageSidebar() {
  const { t } = useTranslation()
  return (
    <div className="w-52 h-full shrink-0 hidden xl:flex flex-col pb-2 pt-4 px-2 justify-between">
      <div className="space-y-2">
        <div className="px-2 mb-8 w-full">
          <Logo />
        </div>
        <PostButton variant="sidebar" />
        <RelaySettingsButton variant="sidebar" />
        <NotificationButton variant="sidebar" />
        <SearchButton variant="sidebar" />
        <AboutInfoDialog>
          <Button variant="sidebar" size="sidebar">
            <Info />
            {t('About')}
          </Button>
        </AboutInfoDialog>
      </div>
      <AccountButton variant="sidebar" />
    </div>
  )
}
