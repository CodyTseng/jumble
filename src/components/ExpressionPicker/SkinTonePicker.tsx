import { cn } from '@/lib/utils'
import { TSkinTone } from '@/types'
import { useEffect, useRef, useState } from 'react'

const TONE_PREVIEW: Record<TSkinTone, string> = {
  0: '✋',
  1: '✋🏻',
  2: '✋🏼',
  3: '✋🏽',
  4: '✋🏾',
  5: '✋🏿'
}

const TONES: TSkinTone[] = [0, 1, 2, 3, 4, 5]

export default function SkinTonePicker({
  value,
  onChange
}: {
  value: TSkinTone
  onChange: (value: TSkinTone) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!expanded) return
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [expanded])

  const handleClick = (tone: TSkinTone) => {
    if (!expanded) {
      setExpanded(true)
      return
    }
    onChange(tone)
    setExpanded(false)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'flex items-center justify-end overflow-hidden rounded-md border bg-background/95 p-0.5 shadow-sm backdrop-blur-sm transition-[gap] duration-200',
        expanded ? 'gap-0.5' : 'gap-0'
      )}
    >
      {TONES.map((tone) => {
        const isSelected = tone === value
        const visible = expanded || isSelected
        return (
          <button
            key={tone}
            type="button"
            onClick={() => handleClick(tone)}
            tabIndex={visible ? 0 : -1}
            aria-hidden={!visible}
            className={cn(
              'flex h-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md text-xl leading-none transition-all duration-200 hover:bg-muted',
              visible ? 'w-9 translate-x-0 opacity-100' : 'pointer-events-none w-0 translate-x-2 opacity-0',
              expanded && isSelected && 'bg-muted'
            )}
          >
            <span className="inline-block">{TONE_PREVIEW[tone]}</span>
          </button>
        )
      })}
    </div>
  )
}
