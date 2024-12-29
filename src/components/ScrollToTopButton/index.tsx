import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
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
  const { isSmallScreen } = useScreenSize()

  const handleScrollToTop = () => {
    if (isSmallScreen) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      className={cn(
        `sticky z-20 flex justify-end pr-6 transition-opacity duration-700 ${visible ? '' : 'opacity-0'} ${isSmallScreen ? 'bottom-20' : 'bottom-6'}`,
        className
      )}
    >
      <Button
        variant="secondary-2"
        className="rounded-full w-12 h-12 p-0 hover:text-background"
        onClick={handleScrollToTop}
      >
        <ChevronUp />
      </Button>
    </div>
  )
}
