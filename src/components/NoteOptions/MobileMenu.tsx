import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerOverlay } from '@/components/ui/drawer'
import { ArrowLeft } from 'lucide-react'
import { MenuAction, SubMenuAction } from './useMenuActions'

interface MobileMenuProps {
  menuActions: MenuAction[]
  trigger: React.ReactNode
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
  showSubMenu: boolean
  activeSubMenu: SubMenuAction[]
  subMenuTitle: string
  closeDrawer: () => void
  goBackToMainMenu: () => void
}

export function MobileMenu({
  menuActions,
  trigger,
  isDrawerOpen,
  setIsDrawerOpen,
  showSubMenu,
  activeSubMenu,
  subMenuTitle,
  closeDrawer,
  goBackToMainMenu
}: MobileMenuProps) {
  return (
    <>
      {trigger}
      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerOverlay onClick={closeDrawer} />
        <DrawerContent hideOverlay className="max-h-[80vh]">
          <div className="overflow-y-auto overscroll-contain py-2" style={{ touchAction: 'pan-y' }}>
            {!showSubMenu ? (
              menuActions.map((action, index) => {
                const Icon = action.icon
                return (
                  <Button
                    key={index}
                    onClick={action.onClick}
                    className={`w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5 ${action.className || ''}`}
                    variant="ghost"
                  >
                    <Icon />
                    {action.label}
                  </Button>
                )
              })
            ) : (
              <>
                <Button
                  onClick={goBackToMainMenu}
                  className="mb-2 w-full justify-start gap-4 p-6 text-lg [&_svg]:size-5"
                  variant="ghost"
                >
                  <ArrowLeft className="rtl:-scale-x-100" />
                  {subMenuTitle}
                </Button>
                <div className="mb-2 border-t border-border" />
                {activeSubMenu.map((subAction, index) => (
                  <Button
                    key={index}
                    onClick={subAction.onClick}
                    className={`w-full justify-start gap-4 p-6 text-lg ${subAction.className || ''}`}
                    variant="ghost"
                  >
                    {subAction.label}
                  </Button>
                ))}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  )
}
