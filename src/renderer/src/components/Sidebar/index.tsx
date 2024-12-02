import { Button } from '@renderer/components/ui/button'
import { IS_ELECTRON } from '@renderer/lib/env'
import { toHome } from '@renderer/lib/link'
import { SecondaryPageLink } from '@renderer/PageManager'
import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AboutInfoDialog from '../AboutInfoDialog'
import AccountButton from '../AccountButton'
import PostButton from '../PostButton'
import RefreshButton from '../RefreshButton'
import RelaySettingsButton from '../RelaySettingsButton'
import SearchButton from '../SearchButton'

export default function PrimaryPageSidebar() {
  const { t } = useTranslation()
  return (
    <div className="draggable w-52 h-full shrink-0 hidden xl:flex flex-col pb-8 pt-9 pl-4 justify-between">
      <div className="space-y-2">
        <div className="text-3xl font-extrabold font-mono text-center mb-4">
          <SecondaryPageLink to={toHome()}>Jumble</SecondaryPageLink>
        </div>
        <PostButton variant="sidebar" />
        <RelaySettingsButton variant="sidebar" />
        <SearchButton variant="sidebar" />
        <RefreshButton variant="sidebar" />
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
