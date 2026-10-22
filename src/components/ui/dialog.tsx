import * as DialogPrimitive from '@radix-ui/react-dialog'
import * as React from 'react'

import { Modal, ModalClose, ModalContent, ModalTrigger } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

// All ordinary dialogs use the same responsive modal and preserve their content
// tree when changing between a bottom sheet and a centered presentation.
const Dialog = Modal
const DialogTrigger = ModalTrigger
const DialogClose = ModalClose

const DialogContent = React.forwardRef<
  React.ElementRef<typeof ModalContent>,
  React.ComponentPropsWithoutRef<typeof ModalContent>
>(({ className, bodyClassName, withoutClose = false, ...props }, ref) => (
  <ModalContent
    ref={ref}
    withoutClose={withoutClose}
    className={cn('max-h-[90dvh]', className)}
    bodyClassName={cn('grid gap-4 p-6', bodyClassName)}
    {...props}
  />
))
DialogContent.displayName = 'DialogContent'

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1.5 text-center sm:text-start', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg leading-6 font-semibold tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
}
