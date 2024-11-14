import AccountButton from '../AccountButton'
import PostButton from '../PostButton'
import RefreshButton from '../RefreshButton'
import RelaySettingsPopover from '../RelaySettingsPopover'

export default function PrimaryPageSidebar() {
  return (
    <div className="draggable w-52 h-full shrink-0 hidden xl:flex flex-col gap-2 pb-8 pt-9 pl-4">
      <div className="text-3xl font-extrabold font-mono text-center mb-2">Jumble</div>
      <AccountButton variant="sidebar" />
      <PostButton variant="sidebar" />
      <RelaySettingsPopover variant="sidebar" />
      <RefreshButton variant="sidebar" />
    </div>
  )
}
