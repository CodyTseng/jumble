import { cn } from '@/lib/utils'

export function LoadingBar({ className }: { className?: string }) {
  return (
    <div className={cn('h-0.5 w-full overflow-hidden', className)}>
      <div
        className="h-full w-full animate-shimmer bg-linear-to-r from-primary/40 from-25% via-primary via-50% to-primary/40 to-75%"
        style={{
          backgroundSize: '400% 100%'
        }}
      />
    </div>
  )
}
