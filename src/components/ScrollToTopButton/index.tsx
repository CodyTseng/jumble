import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { hasBackgroundAudioAtom } from '@/services/media-manager.service'
import { useAtomValue } from 'jotai'
import { ChevronUp } from 'lucide-react'
import { useMemo } from 'react'

export default function ScrollToTopButton({
  scrollAreaRef,
  className
}: {
  scrollAreaRef?: React.RefObject<HTMLDivElement>
  className?: string
}) {
  const { deepBrowsing, lastScrollTop } = useDeepBrowsing()
  const { isSmallScreen } = useScreenSize()
  const hasBackgroundAudio = useAtomValue(hasBackgroundAudioAtom)
  const visible = useMemo(() => !deepBrowsing && lastScrollTop > 800, [deepBrowsing, lastScrollTop])

  const handleScrollToTop = () => {
    if (!scrollAreaRef) {
      // scroll to top with custom animation
      const startPosition = window.pageYOffset || document.documentElement.scrollTop
      const duration = 500
      const startTime = performance.now()

      const easeInOutQuad = (t: number) => {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
      }

      const scroll = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progress = Math.min(elapsed / duration, 1)
        const ease = easeInOutQuad(progress)

        const position = startPosition * (1 - ease)
        window.scrollTo(0, position)

        if (progress < 1) {
          requestAnimationFrame(scroll)
        }
      }

      requestAnimationFrame(scroll)
      return
    }
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div
      className={cn(
        'pointer-events-none sticky z-30 flex w-full justify-end pe-3 transition-all duration-700',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0',
        className
      )}
      style={{
        bottom: isSmallScreen
          ? `calc(env(safe-area-inset-bottom) + ${hasBackgroundAudio ? 7.25 : 3.85}rem)`
          : `calc(env(safe-area-inset-bottom) + 0.85rem)`
      }}
    >
      <Button
        variant="secondary-2"
        className="pointer-events-auto size-12 rounded-full p-0 transition-all duration-200 hover:text-background disabled:pointer-events-none"
        onClick={handleScrollToTop}
        disabled={!visible}
      >
        <ChevronUp />
      </Button>
    </div>
  )
}
