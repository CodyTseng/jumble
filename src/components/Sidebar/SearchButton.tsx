import { Search } from 'lucide-react'
import { useState } from 'react'
import { SearchDialog } from '../SearchDialog'
import SidebarItem from './SidebarItem'

export default function RefreshButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <SidebarItem onClick={() => setOpen(true)} title="Search">
        <Search />
      </SidebarItem>
      <SearchDialog open={open} setOpen={setOpen} />
    </>
  )
}
