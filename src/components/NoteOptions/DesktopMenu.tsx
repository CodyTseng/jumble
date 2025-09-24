import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { MenuAction } from './useMenuActions'

interface DesktopMenuProps {
  menuActions: MenuAction[]
  trigger: React.ReactNode
}

export function DesktopMenu({ menuActions, trigger }: DesktopMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[50vh] overflow-y-auto">
        {menuActions.map((action, index) => {
          const Icon = action.icon
          return (
            <div key={index}>
              {action.separator && index > 0 && <DropdownMenuSeparator />}
              {action.subMenu ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className={action.className}>
                    <Icon />
                    {action.label}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent
                    className="max-h-[50vh] overflow-y-auto"
                    showScrollButtons
                  >
                    {action.subMenu.map((subAction, subIndex) => (
                      <div key={subIndex}>
                        {subAction.separator && subIndex > 0 && <DropdownMenuSeparator />}
                        <DropdownMenuItem
                          onClick={subAction.onClick}
                          className={cn('w-64', subAction.className)}
                        >
                          {subAction.label}
                        </DropdownMenuItem>
                      </div>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem onClick={action.onClick} className={action.className}>
                  <Icon />
                  {action.label}
                </DropdownMenuItem>
              )}
            </div>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
