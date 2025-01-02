import { Search } from 'lucide-react'
import { useState } from 'react'
import { SearchDialog } from '../SearchDialog'
import SidebarItem from './SidebarItem'

export default function SearchButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <SidebarItem
        title="Search"
        description="Search"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
        }}
      >
        <Search strokeWidth={3} />
      </SidebarItem>
      <SearchDialog open={open} setOpen={setOpen} />
    </>
  )
}
