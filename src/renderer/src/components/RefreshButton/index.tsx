import { Button } from '@renderer/components/ui/button'
import { usePrimaryPage } from '@renderer/PageManager'
import { RefreshCcw } from 'lucide-react'

export default function RefreshButton({
  variant = 'titlebar'
}: {
  variant?: 'titlebar' | 'sidebar'
}) {
  const { refresh } = usePrimaryPage()
  return (
    <Button variant={variant} size={variant} onClick={refresh} title="reload">
      <RefreshCcw />
      {variant === 'sidebar' && <div>Refresh</div>}
    </Button>
  )
}
