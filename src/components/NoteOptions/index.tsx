import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuSeparator,
  ResponsiveMenuSub,
  ResponsiveMenuSubContent,
  ResponsiveMenuSubTrigger,
  ResponsiveMenuTrigger
} from '@/components/ui/responsive-menu'
import { Ellipsis } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import RawEventDialog from './RawEventDialog'
import ReportDialog from './ReportDialog'
import { useMenuActions } from './useMenuActions'

export default function NoteOptions({ event, className }: { event: Event; className?: string }) {
  const [isRawEventDialogOpen, setIsRawEventDialogOpen] = useState(false)
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false)

  const menuActions = useMenuActions({
    event,
    setIsRawEventDialogOpen,
    setIsReportDialogOpen
  })

  return (
    <div className={className} onClick={(e) => e.stopPropagation()}>
      <ResponsiveMenu>
        <ResponsiveMenuTrigger asChild>
          <button className="flex items-center text-muted-foreground hover:text-foreground pl-2 h-full">
            <Ellipsis />
          </button>
        </ResponsiveMenuTrigger>

        <ResponsiveMenuContent showScrollButtons>
          {menuActions.map((action, index) => {
            const Icon = action.icon
            return (
              <div key={index}>
                {action.separator && index > 0 && <ResponsiveMenuSeparator />}
                {action.subMenu ? (
                  <ResponsiveMenuSub>
                    <ResponsiveMenuSubTrigger className={action.className}>
                      <Icon />
                      {action.label}
                    </ResponsiveMenuSubTrigger>
                    <ResponsiveMenuSubContent showScrollButtons>
                      {action.subMenu.map((subAction, subIndex) => (
                        <div key={subIndex}>
                          {subAction.separator && subIndex > 0 && <ResponsiveMenuSeparator />}
                          <ResponsiveMenuItem
                            onClick={subAction.onClick}
                            className={subAction.className}
                          >
                            {subAction.label}
                          </ResponsiveMenuItem>
                        </div>
                      ))}
                    </ResponsiveMenuSubContent>
                  </ResponsiveMenuSub>
                ) : (
                  <ResponsiveMenuItem onClick={action.onClick} className={action.className}>
                    <Icon />
                    {action.label}
                  </ResponsiveMenuItem>
                )}
              </div>
            )
          })}
        </ResponsiveMenuContent>
      </ResponsiveMenu>

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
