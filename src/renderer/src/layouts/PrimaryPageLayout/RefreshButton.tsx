import { Button } from '@renderer/components/ui/button'
import { usePrimaryPage } from '@renderer/PageManager'
import { RefreshCcw } from 'lucide-react'

export default function RefreshButton() {
  const { refresh } = usePrimaryPage()
  return (
    <Button variant="titlebar" size="titlebar" onClick={refresh} title="reload">
      <RefreshCcw />
    </Button>
  )
}
