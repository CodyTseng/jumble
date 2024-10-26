import { cn } from '@renderer/lib/utils'
import { useState } from 'react'

export default function NsfwOverlay({ className }: { className?: string }) {
  const [isHidden, setIsHidden] = useState(true)

  return (
    isHidden && (
      <div
        className={cn(
          'absolute top-0 left-0 backdrop-blur-3xl w-full h-full cursor-pointer',
          className
        )}
        onClick={() => setIsHidden(false)}
      />
    )
  )
}
