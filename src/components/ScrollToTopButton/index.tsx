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
        `sticky z-20 flex justify-end pr-3 transition-opacity duration-700 ${visible ? '' : 'opacity-0'}`,
        className
      )}
      style={{
        bottom: isSmallScreen
          ? 'calc(env(safe-area-inset-bottom) + 3.75rem)'
          : 'calc(env(safe-area-inset-bottom) + 0.75rem)'
      }}
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
