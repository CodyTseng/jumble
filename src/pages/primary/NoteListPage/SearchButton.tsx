import { SearchDialog } from '@/components/SearchDialog'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { useState } from 'react'

export default function SearchButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="ghost" size="titlebar-icon" onClick={() => setOpen(true)}>
        <Search />
      </Button>
      <SearchDialog open={open} setOpen={setOpen} />
    </>
  )
}
