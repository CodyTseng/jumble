import { Drawer, DrawerOverlay, DrawerPortal } from '@/components/ui/drawer'
import { Drawer as DrawerPrimitive } from 'vaul'
import MeDrawerContent from './MeDrawerContent'

export default function MeDrawer({
  open,
  setOpen
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  return (
    <Drawer open={open} onOpenChange={setOpen} direction="left">
      <DrawerPortal>
        <DrawerOverlay />
        <DrawerPrimitive.Content
          className="fixed inset-y-0 left-0 z-50 flex h-full w-[85%] max-w-sm flex-col rounded-r-xl bg-background"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DrawerPrimitive.Title className="sr-only">Menu</DrawerPrimitive.Title>
          <DrawerPrimitive.Description className="sr-only">User menu</DrawerPrimitive.Description>
          <MeDrawerContent onClose={() => setOpen(false)} />
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  )
}
