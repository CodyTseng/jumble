import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { BellOff, Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DesktopMenu } from './DesktopMenu'
import { MobileMenu } from './MobileMenu'
import RawEventDialog from './RawEventDialog'
import ReportDialog from './ReportDialog'
import { SubMenuAction, useMenuActions } from './useMenuActions'

export default function NoteOptions({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const mutedStatusId = useId()
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)
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

  const { menuActions, areNotificationsMuted } = useMenuActions({
    event,
    menuTriggerRef,
    closeDrawer,
    showSubMenuActions,
    setIsRawEventDialogOpen,
    setIsReportDialogOpen,
    isSmallScreen
  })

  const mutedStatus = areNotificationsMuted ? t('Note notifications muted') : undefined
  const trigger = (
    <button
      ref={menuTriggerRef}
      type="button"
      aria-label={t('Options')}
      aria-describedby={mutedStatus ? mutedStatusId : undefined}
      title={mutedStatus}
      className="text-muted-foreground hover:text-foreground flex h-full cursor-pointer items-center gap-1 ps-2"
      onClick={() => setIsDrawerOpen(true)}
    >
      {areNotificationsMuted && <BellOff aria-hidden="true" className="text-destructive" />}
      <Ellipsis aria-hidden="true" />
    </button>
  )

  return (
    <div className={className}>
      {mutedStatus && (
        <span className="sr-only" id={mutedStatusId}>
          {mutedStatus}
        </span>
      )}
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
      <ReportDialog
        event={event}
        isOpen={isReportDialogOpen}
        closeDialog={() => setIsReportDialogOpen(false)}
      />
    </div>
  )
}
