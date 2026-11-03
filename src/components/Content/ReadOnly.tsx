import { cn } from '@/lib/utils'
import { ReactNode, SyntheticEvent } from 'react'

function preventActivation(event: SyntheticEvent) {
  event.preventDefault()
  event.stopPropagation()
}

// Keep preview content readable by assistive technology while blocking activation.
export default function ReadOnly({
  children,
  className = 'contents'
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      aria-disabled="true"
      className={cn('pointer-events-none', className)}
      onClickCapture={preventActivation}
      onAuxClickCapture={preventActivation}
      // Let pointer events reach document so modal outside-interaction tracking resets.
      onPointerDownCapture={(event) => event.preventDefault()}
      onKeyDownCapture={(event) => {
        if (event.key === 'Enter' || event.key === ' ') preventActivation(event)
      }}
    >
      {children}
    </div>
  )
}
