import Wreath from '@renderer/assets/christmas/wreath.png'
import Logo from '@renderer/assets/Logo'
import { Button } from '@renderer/components/ui/button'
import { IS_ELECTRON } from '@renderer/lib/env'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AboutInfoDialog from '../AboutInfoDialog'
import AccountButton from '../AccountButton'
import NotificationButton from '../NotificationButton'
import PostButton from '../PostButton'
import RefreshButton from '../RefreshButton'
import RelaySettingsButton from '../RelaySettingsButton'
import SearchButton from '../SearchButton'

export default function PrimaryPageSidebar() {
  const { t } = useTranslation()
  return (
    <div className="w-52 h-full shrink-0 hidden xl:flex flex-col pb-8 pt-10 pl-4 justify-between relative">
      <div className="draggable absolute top-0 left-0 h-11 w-full" />
      <div className="space-y-2">
        <div className="draggable ml-4 mb-8 w-40 relative">
          <Logo />
          <img
            src={Wreath}
            alt="Wreath"
            className="absolute -translate-y-20 left-6 w-28 h-28 -z-10"
          />
        </div>
        <PostButton variant="sidebar" />
        <RelaySettingsButton variant="sidebar" />
        <NotificationButton variant="sidebar" />
        <SearchButton variant="sidebar" />
        {IS_ELECTRON && <RefreshButton variant="sidebar" />}
        {!IS_ELECTRON && (
          <AboutInfoDialog>
            <Button variant="sidebar" size="sidebar">
              <Info />
              {t('About')}
            </Button>
          </AboutInfoDialog>
        )}
      </div>
      <AccountButton variant="sidebar" />
    </div>
  )
}
