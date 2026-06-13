import { isClickInsideNestedCardOrControl } from '@/lib/utils'
import { forwardRef, HTMLAttributes } from 'react'

const ClickableCard = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ onClick, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        {...rest}
        data-clickable-card
        onClick={(e) => {
          if (isClickInsideNestedCardOrControl(e)) return
          onClick?.(e)
        }}
      >
        {children}
      </div>
    )
  }
)
ClickableCard.displayName = 'ClickableCard'

export default ClickableCard
