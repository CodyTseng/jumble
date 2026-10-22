import { Button } from '@/components/ui/button'
import { Modal, ModalContent } from '@/components/ui/modal'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  return (
    <>
      {trigger}
      <Modal
        open={isDrawerOpen}
        // Route close events through closeDrawer so the parent also resets
        // showSubMenu — otherwise reopening the drawer would land on the
        // previously-open submenu instead of the root menu.
        onOpenChange={(open) => (open ? setIsDrawerOpen(true) : closeDrawer())}
      >
        <ModalContent title={subMenuTitle || t('Options')} className="max-h-[80dvh]">
          <div className="overflow-y-auto overscroll-contain py-2">
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
                <div className="border-border mb-2 border-t" />
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
        </ModalContent>
      </Modal>
    </>
  )
}
