import * as SliderPrimitive from '@radix-ui/react-slider'
import * as React from 'react'

import { cn } from '@/lib/utils'

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> & {
    hideThumb?: boolean
    enableHoverAnimation?: boolean
  }
>(({ className, hideThumb, enableHoverAnimation, ...props }, ref) => {
  const [isHovered, setIsHovered] = React.useState(false)

  return (
    <SliderPrimitive.Root
      ref={ref}
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      {...props}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
    >
      <SliderPrimitive.Track
        className={cn(
          'relative w-full grow overflow-hidden rounded-full bg-primary/20 cursor-pointer transition-all',
          isHovered && enableHoverAnimation ? 'h-3' : 'h-1.5'
        )}
      >
        <SliderPrimitive.Range className="absolute h-full bg-primary disabled:bg-primary/30 rounded-full" />
      </SliderPrimitive.Track>
      {!hideThumb && (
        <SliderPrimitive.Thumb
          className={cn(
            'block h-4 w-4 rounded-full border-2 border-primary bg-background transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'
          )}
        />
      )}
    </SliderPrimitive.Root>
  )
})
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
