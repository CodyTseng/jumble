import { Button } from '@/components/ui/button'
import { DrawerClose } from '@/components/ui/drawer'
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
    <DrawerClose className="w-full">
      <Button
        onClick={onClick}
        className={cn('w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5', className)}
        variant="ghost"
      >
        {children}
      </Button>
    </DrawerClose>
  )
}
