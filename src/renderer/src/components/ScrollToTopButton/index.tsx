import { Button } from '@renderer/components/ui/button'
import { ChevronUp } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ScrollToTopButton({
  scrollAreaRef
}: {
  scrollAreaRef: React.RefObject<HTMLDivElement>
}) {
  const [showScrollToTop, setShowScrollToTop] = useState(false)

  const handleScrollToTop = () => {
    scrollAreaRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleScroll = () => {
    if (scrollAreaRef.current) {
      setShowScrollToTop(scrollAreaRef.current.scrollTop > 1000)
    }
  }

  useEffect(() => {
    const scrollArea = scrollAreaRef.current
    scrollArea?.addEventListener('scroll', handleScroll)
    return () => {
      scrollArea?.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <Button
      variant="secondary-2"
      className={`absolute bottom-8 right-2 rounded-full w-10 h-10 p-0 hover:text-background transition-transform ${showScrollToTop ? '' : 'translate-y-20'}`}
      onClick={handleScrollToTop}
    >
      <ChevronUp />
    </Button>
  )
}
