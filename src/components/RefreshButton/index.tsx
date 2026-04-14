import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { RefreshCcw } from 'lucide-react'
import { useState } from 'react'

export function RefreshButton({
  onClick,
  loading = false
}: {
  onClick: () => void
  loading?: boolean
}) {
  const [refreshing, setRefreshing] = useState(false)
  const spinning = refreshing || loading

  return (
    <Button
      variant="ghost"
      size="titlebar-icon"
      disabled={spinning}
      onClick={() => {
        setRefreshing(true)
        onClick()
        setTimeout(() => setRefreshing(false), 500)
      }}
      className="text-muted-foreground focus:text-foreground"
    >
      <RefreshCcw className={cn(spinning ? 'animate-spin' : '')} />
    </Button>
  )
}
