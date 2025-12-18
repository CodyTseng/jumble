import { Button } from '@/components/ui/button'
import { Highlighter } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface HighlightButtonProps {
  onHighlight: (selectedText: string) => void
  containerRef?: React.RefObject<HTMLElement>
}

export default function HighlightButton({ onHighlight, containerRef }: HighlightButtonProps) {
  const { t } = useTranslation()
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const buttonRef = useRef<HTMLButtonElement>(null)

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
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
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
      className="fixed z-50 animate-in fade-in-0 slide-in-from-bottom-4 duration-200"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`
      }}
    >
      <Button
        ref={buttonRef}
        size="sm"
        variant="default"
        className="shadow-lg gap-2 -translate-x-1/2"
        onClick={(e) => {
          e.stopPropagation()
          onHighlight(selectedText)
          // Clear selection after highlighting
          window.getSelection()?.removeAllRanges()
          setPosition(null)
          setSelectedText('')
        }}
      >
        <Highlighter className="h-4 w-4" />
        {t('Highlight')}
      </Button>
    </div>
  )
}
