import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChevronUp } from 'lucide-react'

export default function ScrollToTopButton({
  scrollAreaRef,
  className,
  visible = true
}: {
  scrollAreaRef: React.RefObject<HTMLDivElement>
  className?: string
  visible?: boolean
}) {
  const handleScrollToTop = () => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <Button
      variant="secondary-2"
      className={cn(
        `absolute bottom-6 right-6 rounded-full w-12 h-12 p-0 hover:text-background transition-transform ${visible ? '' : 'translate-y-20'}`,
        className
      )}
      onClick={handleScrollToTop}
    >
      <ChevronUp />
    </Button>
  )
}
