import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ReactNode } from 'react'

/** A bottom sheet on small screens and a centered dialog on larger screens. */
export default function ResponsiveDialog({
  open,
  onOpenChange,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] w-130" bodyClassName="overflow-auto py-8">
        {children}
      </DialogContent>
    </Dialog>
  )
}
