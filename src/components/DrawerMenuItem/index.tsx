import { Button } from '@/components/ui/button'
import { ModalClose } from '@/components/ui/modal'
import { cn } from '@/lib/utils'

export default function DrawerMenuItem({
  children,
  className,
  onClick
}: {
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return (
    <ModalClose asChild>
      <Button
        onClick={onClick}
        className={cn('w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5', className)}
        variant="ghost"
      >
        {children}
      </Button>
    </ModalClose>
  )
}
