import { cn } from '@/lib/utils'

export function LoadingBar({ className }: { className?: string }) {
  return (
    <div
      className={cn('h-0.5 w-full overflow-hidden', className)}
      role="progressbar"
      aria-label="Loading"
      aria-busy="true"
    >
      <div
        className="h-full w-full bg-gradient-to-r from-primary/40 from-25% via-primary via-50% to-primary/40 to-75% animate-shimmer"
        style={{
          backgroundSize: '400% 100%'
        }}
      />
    </div>
  )
}
