import { cn } from '@/lib/utils'
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
        className={cn('rounded-lg', size === 'small' ? 'h-[15vh]' : 'h-[30vh]', className)}
        src={src}
        onClick={(e) => e.stopPropagation()}
      />
      {isNsfw && <NsfwOverlay className="rounded-lg" />}
    </div>
  )
}
