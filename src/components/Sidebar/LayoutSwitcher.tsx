import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { Columns2, PanelLeft } from 'lucide-react'

export default function LayoutSwitcher({
  collapse,
  disabled = false
}: {
  collapse: boolean
  disabled?: boolean
}) {
  const { enableSingleColumnLayout, updateEnableSingleColumnLayout } = useUserPreferences()

  if (collapse) {
    return (
      <Button
        variant="ghost"
        className="size-12 hover:border"
        disabled={disabled}
        onClick={() => updateEnableSingleColumnLayout(!enableSingleColumnLayout)}
      >
        {enableSingleColumnLayout ? (
          <PanelLeft className="size-5!" />
        ) : (
          <Columns2 className="size-5!" />
        )}
      </Button>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg bg-muted p-1 shadow-inner',
        disabled && 'pointer-events-none opacity-50'
      )}
    >
      <div className="relative flex items-center justify-around">
        <div
          className="z-10 flex w-full cursor-pointer flex-col items-center py-1"
          onClick={() => updateEnableSingleColumnLayout(false)}
        >
          <Columns2 className={cn('size-5', enableSingleColumnLayout && 'text-muted-foreground')} />
        </div>
        <div
          className="z-10 flex w-full cursor-pointer flex-col items-center py-1"
          onClick={() => updateEnableSingleColumnLayout(true)}
        >
          <PanelLeft
            className={cn('size-5', !enableSingleColumnLayout && 'text-muted-foreground')}
          />
        </div>
        <div
          className={cn(
            'absolute inset-0 start-0 top-0 h-full w-1/2 rounded-md shadow-xs transition-transform',
            !enableSingleColumnLayout
              ? 'translate-x-0 bg-surface-background'
              : 'translate-x-full rtl:-translate-x-full bg-background'
          )}
        />
      </div>
    </div>
  )
}
