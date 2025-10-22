import { cn } from '@/lib/utils'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { Columns2, PanelLeft } from 'lucide-react'

export default function LayoutSwitcher({ collapse }: { collapse: boolean }) {
  const { enableSingleColumnLayout, updateEnableSingleColumnLayout } = useUserPreferences()

  return (
    <div className="rounded-lg bg-muted p-1 m-1 shadow-inner">
      <div className={cn('relative flex items-center justify-around', collapse ? 'flex-col' : '')}>
        <div
          className={cn(
            'py-1 w-full z-10 cursor-pointer flex flex-col items-center',
            collapse && 'py-2'
          )}
          onClick={() => updateEnableSingleColumnLayout(false)}
        >
          <Columns2 className={cn('size-5', enableSingleColumnLayout && 'text-muted-foreground')} />
        </div>
        <div
          className={cn(
            'py-1 w-full z-10 cursor-pointer flex flex-col items-center',
            collapse && 'py-2'
          )}
          onClick={() => updateEnableSingleColumnLayout(true)}
        >
          <PanelLeft
            className={cn('size-5', !enableSingleColumnLayout && 'text-muted-foreground')}
          />
        </div>
        <div
          className={cn(
            'rounded-md absolute top-0 left-0 inset-0 transition-transform shadow-sm',
            collapse ? 'w-full h-1/2' : 'w-1/2 h-full',
            !enableSingleColumnLayout
              ? 'translate-x-0 bg-surface-background'
              : collapse
                ? 'translate-y-full bg-background'
                : 'translate-x-full bg-background'
          )}
        />
      </div>
    </div>
  )
}
