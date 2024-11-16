import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@renderer/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-muted/80',
        'secondary-2': 'bg-secondary text-secondary-foreground hover:bg-highlight',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        titlebar: 'non-draggable hover:bg-accent hover:text-accent-foreground',
        sidebar: 'non-draggable hover:bg-accent hover:text-accent-foreground'
      },
      size: {
        default: 'h-8 rounded-lg px-3',
        sm: 'h-8 rounded-lg px-2',
        lg: 'h-10 px-4 py-2',
        icon: 'h-8 w-8 rounded-full',
        titlebar: 'h-7 w-7 rounded-full',
        sidebar: 'w-full flex py-2 px-4 rounded-full justify-start gap-4 text-lg font-semibold'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
