import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import { DesktopMenu } from './DesktopMenu'
import { MobileMenu } from './MobileMenu'
import RawEventDialog from './RawEventDialog'
import { SubMenuAction, useMenuActions } from './useMenuActions'

export default function NoteOptions({ event, className }: { event: Event; className?: string }) {
  const { isSmallScreen } = useScreenSize()
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [showSubMenu, setShowSubMenu] = useState(false)
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenuAction[]>([])
  const [subMenuTitle, setSubMenuTitle] = useState('')

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setShowSubMenu(false)
  }

  const goBackToMainMenu = () => {
    setShowSubMenu(false)
  }

  const showSubMenuActions = (subMenu: SubMenuAction[], title: string) => {
    setActiveSubMenu(subMenu)
    setSubMenuTitle(title)
    setShowSubMenu(true)
  }

  const menuActions = useMenuActions({
    event,
    closeDrawer,
    showSubMenuActions,
    setIsRawEventDialogOpen,
    isSmallScreen
  })

  const trigger = (
    <button
      className="flex items-center text-muted-foreground hover:text-foreground pl-2 h-full"
      onClick={() => setIsDrawerOpen(true)}
    >
      <Ellipsis />
    </button>
  )

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      {isSmallScreen ? (
        <MobileMenu
          menuActions={menuActions}
          trigger={trigger}
          isDrawerOpen={isDrawerOpen}
          setIsDrawerOpen={setIsDrawerOpen}
          showSubMenu={showSubMenu}
          activeSubMenu={activeSubMenu}
          subMenuTitle={subMenuTitle}
          closeDrawer={closeDrawer}
          goBackToMainMenu={goBackToMainMenu}
        />
      ) : (
        <DesktopMenu menuActions={menuActions} trigger={trigger} />
      )}

      <RawEventDialog
        event={event}
        isOpen={isRawEventDialogOpen}
        onClose={() => setIsRawEventDialogOpen(false)}
      />
    </div>
  )
}
