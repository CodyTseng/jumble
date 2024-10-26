import { cn } from '@renderer/lib/utils'
import NsfwOverlay from '../NsfwOverlay'

export default function VideoPlayer({
  src,
  className,
  isNsfw = false,
  size = 'normal'
}: {
  src: string
  className?: string
  isNsfw?: boolean
  size?: 'normal' | 'small'
}) {
  return (
    <div className="relative">
      <video
        controls
        className={cn('rounded-lg', size === 'small' ? 'max-h-[20vh]' : 'max-h-[50vh]', className)}
        src={src}
      />
      {isNsfw && <NsfwOverlay className="rounded-lg" />}
    </div>
  )
}
