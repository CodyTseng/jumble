import { toHome } from '@renderer/lib/link'
import { SecondaryPageLink } from '@renderer/PageManager'
import AccountButton from '../AccountButton'
import PostButton from '../PostButton'
import RefreshButton from '../RefreshButton'
import RelaySettingsPopover from '../RelaySettingsPopover'

export default function PrimaryPageSidebar() {
  return (
    <div className="draggable w-52 h-full shrink-0 hidden xl:flex flex-col pb-8 pt-9 pl-4 justify-between">
      <div className="space-y-2">
        <div className="text-3xl font-extrabold font-mono text-center mb-4">
          <SecondaryPageLink to={toHome()}>Jumble</SecondaryPageLink>
        </div>
        <PostButton variant="sidebar" />
        <RelaySettingsPopover variant="sidebar" />
        <RefreshButton variant="sidebar" />
      </div>
      <AccountButton variant="sidebar" />
    </div>
  )
}
