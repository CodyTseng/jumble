import { cn } from '@renderer/lib/utils'
import NsfwOverlay from '../NsfwOverlay'

export default function VideoPlayer({
  src,
  className,
  isNsfw = false
}: {
  src: string
  className?: string
  isNsfw?: boolean
}) {
  return (
    <div className="relative">
      <video controls className={cn('rounded-lg max-h-[50vh] max-w-full', className)} src={src} />
      {isNsfw && <NsfwOverlay className="rounded-lg" />}
    </div>
  )
}
