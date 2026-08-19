import { Button } from '@/components/ui/button'
import { Copy, Highlighter } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

interface HighlightButtonProps {
  onHighlight: (selectedText: string) => void
  containerRef?: React.RefObject<HTMLElement | null>
}

export default function HighlightButton({ onHighlight, containerRef }: HighlightButtonProps) {
  const { t } = useTranslation()
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const actionsRef = useRef<HTMLDivElement>(null)

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges()
    setPosition(null)
    setSelectedText('')
  }

  useEffect(() => {
    const handleSelectionEnd = () => {
      // Use a small delay to ensure selection is complete
      setTimeout(() => {
        const selection = window.getSelection()
        const text = selection?.toString().trim()

        if (!text || text.length === 0) {
          setPosition(null)
          setSelectedText('')
          return
        }

        // Check if selection is within the container (if provided)
        if (containerRef?.current) {
          const range = selection?.getRangeAt(0)
          if (range && !containerRef.current.contains(range.commonAncestorContainer)) {
            setPosition(null)
            setSelectedText('')
            return
          }
        }

        const range = selection?.getRangeAt(0)
        if (!range) return

        // Get the bounding rect of the entire selection
        const rect = range.getBoundingClientRect()
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

        // Position button above the selection area, centered horizontally
        setPosition({
          top: rect.top + scrollTop - 48, // 48px above the selection
          left: rect.left + scrollLeft + rect.width / 2 // Center of the selection
        })
        setSelectedText(text)
      }, 10)
    }

    // Only listen to mouseup and touchend (when user finishes selection)
    document.addEventListener('mouseup', handleSelectionEnd)
    document.addEventListener('touchend', handleSelectionEnd)

    return () => {
      document.removeEventListener('mouseup', handleSelectionEnd)
      document.removeEventListener('touchend', handleSelectionEnd)
    }
  }, [containerRef])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) {
        const selection = window.getSelection()
        if (!selection?.toString().trim()) {
          setPosition(null)
          setSelectedText('')
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  if (!position || !selectedText) {
    return null
  }

  return (
    <div
      ref={actionsRef}
      className="bg-primary animate-in fade-in-0 slide-in-from-bottom-4 fixed z-50 flex -translate-x-1/2 overflow-hidden rounded-md shadow-lg duration-200"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`
      }}
    >
      <Button
        size="sm"
        variant="default"
        className="rounded-none shadow-none"
        onClick={(e) => {
          e.stopPropagation()
          onHighlight(selectedText)
          clearSelection()
        }}
      >
        <Highlighter className="h-4 w-4" />
        {t('Highlight')}
      </Button>
      <Button
        size="sm"
        variant="default"
        className="border-primary-foreground/20 rounded-none border-s shadow-none"
        onClick={async (e) => {
          e.stopPropagation()
          try {
            await navigator.clipboard.writeText(selectedText)
            toast.success(t('Copied to Clipboard'))
            clearSelection()
          } catch (error) {
            console.error('Failed to copy selected text:', error)
          }
        }}
      >
        <Copy className="h-4 w-4" />
        {t('Copy')}
      </Button>
    </div>
  )
}
