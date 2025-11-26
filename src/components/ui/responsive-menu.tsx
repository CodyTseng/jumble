import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerOverlay, DrawerTrigger } from '@/components/ui/drawer'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ArrowLeft, Check } from 'lucide-react'
import * as React from 'react'

// ============================================================================
// Context
// ============================================================================

interface ResponsiveMenuContextValue {
  isSmallScreen: boolean
  closeMenu: () => void
  openSubMenu: (title: React.ReactNode, content: React.ReactNode) => void
  goBack: () => void
}

const ResponsiveMenuContext = React.createContext<ResponsiveMenuContextValue | undefined>(undefined)

function useResponsiveMenuContext() {
  const context = React.useContext(ResponsiveMenuContext)
  if (!context) {
    throw new Error('ResponsiveMenu components must be used within ResponsiveMenu')
  }
  return context
}

// ============================================================================
// Root Component
// ============================================================================

interface ResponsiveMenuProps {
  children: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function ResponsiveMenu({
  children,
  open: controlledOpen,
  onOpenChange
}: ResponsiveMenuProps) {
  const { isSmallScreen } = useScreenSize()
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const [subMenuContent, setSubMenuContent] = React.useState<React.ReactNode>(null)
  const [subMenuTitle, setSubMenuTitle] = React.useState<React.ReactNode>('')

  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(open)
      }
      onOpenChange?.(open)

      // Reset submenu when closing
      if (!open) {
        setSubMenuContent(null)
        setSubMenuTitle('')
      }
    },
    [controlledOpen, onOpenChange]
  )

  const closeMenu = React.useCallback(() => {
    handleOpenChange(false)
  }, [handleOpenChange])

  const openSubMenu = React.useCallback((title: React.ReactNode, content: React.ReactNode) => {
    setSubMenuTitle(title)
    setSubMenuContent(content)
  }, [])

  const goBack = React.useCallback(() => {
    setSubMenuContent(null)
    setSubMenuTitle('')
  }, [])

  const contextValue = React.useMemo(
    () => ({
      isSmallScreen,
      closeMenu,
      openSubMenu,
      goBack
    }),
    [isSmallScreen, closeMenu, openSubMenu, goBack]
  )

  if (isSmallScreen) {
    return (
      <ResponsiveMenuContext.Provider value={contextValue}>
        <Drawer open={isOpen} onOpenChange={handleOpenChange}>
          {React.Children.map(children, (child) => {
            if (React.isValidElement(child) && child.type === ResponsiveMenuTrigger) {
              const props = child.props as { children: React.ReactNode }
              return <DrawerTrigger asChild>{props.children}</DrawerTrigger>
            }
            if (React.isValidElement(child) && child.type === ResponsiveMenuContent) {
              const props = child.props as { children: React.ReactNode; className?: string }
              return (
                <>
                  <DrawerOverlay onClick={closeMenu} />
                  <DrawerContent hideOverlay className={cn('max-h-[80vh]', props.className)}>
                    <div
                      className="overflow-y-auto overscroll-contain py-2"
                      style={{ touchAction: 'pan-y' }}
                    >
                      {subMenuContent ? (
                        <>
                          <Button
                            onClick={goBack}
                            className="w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5 mb-2"
                            variant="ghost"
                          >
                            <ArrowLeft />
                            {subMenuTitle}
                          </Button>
                          <div className="border-t border-border mb-2" />
                          {subMenuContent}
                        </>
                      ) : (
                        props.children
                      )}
                    </div>
                  </DrawerContent>
                </>
              )
            }
            return null
          })}
        </Drawer>
      </ResponsiveMenuContext.Provider>
    )
  }

  return (
    <ResponsiveMenuContext.Provider value={contextValue}>
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        {children}
      </DropdownMenu>
    </ResponsiveMenuContext.Provider>
  )
}

// ============================================================================
// Trigger Component
// ============================================================================

interface ResponsiveMenuTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

export function ResponsiveMenuTrigger({ children, asChild }: ResponsiveMenuTriggerProps) {
  const { isSmallScreen } = useResponsiveMenuContext()

  if (isSmallScreen) {
    // Trigger is handled in ResponsiveMenu root
    return <>{children}</>
  }

  return <DropdownMenuTrigger asChild={asChild}>{children}</DropdownMenuTrigger>
}

// ============================================================================
// Content Component
// ============================================================================

interface ResponsiveMenuContentProps {
  children: React.ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
  showScrollButtons?: boolean
}

export function ResponsiveMenuContent({
  children,
  className,
  align,
  side,
  sideOffset,
  showScrollButtons = false
}: ResponsiveMenuContentProps) {
  const { isSmallScreen } = useResponsiveMenuContext()

  if (isSmallScreen) {
    // Content is handled in ResponsiveMenu root
    return <>{children}</>
  }

  return (
    <DropdownMenuContent
      className={className}
      align={align}
      side={side}
      sideOffset={sideOffset}
      showScrollButtons={showScrollButtons}
    >
      {children}
    </DropdownMenuContent>
  )
}

// ============================================================================
// Item Component
// ============================================================================

interface ResponsiveMenuItemProps {
  children: React.ReactNode
  onClick?: React.MouseEventHandler<HTMLDivElement | HTMLButtonElement>
  className?: string
  disabled?: boolean
}

export function ResponsiveMenuItem({
  children,
  onClick,
  className,
  disabled
}: ResponsiveMenuItemProps) {
  const { isSmallScreen, closeMenu } = useResponsiveMenuContext()

  if (isSmallScreen) {
    return (
      <Button
        onClick={(e) => {
          onClick?.(e)
          closeMenu()
        }}
        disabled={disabled}
        className={cn('w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5', className)}
        variant="ghost"
      >
        {children}
      </Button>
    )
  }

  return (
    <DropdownMenuItem
      onClick={(e) => {
        onClick?.(e)
        closeMenu()
      }}
      disabled={disabled}
      className={className}
    >
      {children}
    </DropdownMenuItem>
  )
}

// ============================================================================
// CheckboxItem Component
// ============================================================================

interface ResponsiveMenuCheckboxItemProps {
  children: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
  disabled?: boolean
}

export function ResponsiveMenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  className,
  disabled
}: ResponsiveMenuCheckboxItemProps) {
  const { isSmallScreen } = useResponsiveMenuContext()

  if (isSmallScreen) {
    return (
      <div
        onClick={() => {
          if (disabled) return
          onCheckedChange(!checked)
        }}
        className={cn(
          'flex items-center gap-2 px-4 py-3 clickable',
          disabled && 'opacity-50 pointer-events-none',
          className
        )}
      >
        <div className="flex items-center justify-center size-4 shrink-0">
          {checked && <Check className="size-4" />}
        </div>
        {children}
      </div>
    )
  }

  return (
    <DropdownMenuCheckboxItem
      checked={checked}
      onSelect={(e) => e.preventDefault()}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn('flex items-center gap-2', className)}
    >
      {children}
    </DropdownMenuCheckboxItem>
  )
}

// ============================================================================
// Separator Component
// ============================================================================

interface ResponsiveMenuSeparatorProps {
  className?: string
}

export function ResponsiveMenuSeparator({ className }: ResponsiveMenuSeparatorProps) {
  const { isSmallScreen } = useResponsiveMenuContext()

  if (isSmallScreen) {
    return <div className={cn('border-t border-border my-2', className)} />
  }

  return <DropdownMenuSeparator className={className} />
}

// ============================================================================
// Label Component
// ============================================================================

interface ResponsiveMenuLabelProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveMenuLabel({ children, className }: ResponsiveMenuLabelProps) {
  const { isSmallScreen } = useResponsiveMenuContext()

  if (isSmallScreen) {
    return (
      <div className={cn('px-6 py-3 text-sm font-semibold text-muted-foreground', className)}>
        {children}
      </div>
    )
  }

  return <DropdownMenuLabel className={className}>{children}</DropdownMenuLabel>
}

// ============================================================================
// Sub Menu Components
// ============================================================================

const ResponsiveMenuSubContext = React.createContext<{
  registerSubContent: (content: React.ReactNode) => void
} | null>(null)

interface ResponsiveMenuSubProps {
  children: React.ReactNode
}

export function ResponsiveMenuSub({ children }: ResponsiveMenuSubProps) {
  const { isSmallScreen, openSubMenu } = useResponsiveMenuContext()
  const [subContent, setSubContent] = React.useState<React.ReactNode>(null)
  const [title, setTitle] = React.useState<React.ReactNode>('')

  const registerSubContent = React.useCallback((content: React.ReactNode) => {
    setSubContent(content)
  }, [])

  const registerTitle = React.useCallback((titleContent: React.ReactNode) => {
    setTitle(titleContent)
  }, [])

  const handleTriggerClick = React.useCallback(() => {
    if (isSmallScreen && subContent) {
      openSubMenu(title, subContent)
    }
  }, [isSmallScreen, subContent, openSubMenu, title])

  if (isSmallScreen) {
    return (
      <ResponsiveMenuSubContext.Provider value={{ registerSubContent }}>
        <ResponsiveMenuSubTitleContext.Provider
          value={{ registerTitle, onTriggerClick: handleTriggerClick }}
        >
          {children}
        </ResponsiveMenuSubTitleContext.Provider>
      </ResponsiveMenuSubContext.Provider>
    )
  }

  return <DropdownMenuSub>{children}</DropdownMenuSub>
}

const ResponsiveMenuSubTitleContext = React.createContext<{
  registerTitle: (title: React.ReactNode) => void
  onTriggerClick: () => void
} | null>(null)

interface ResponsiveMenuSubTriggerProps {
  children: React.ReactNode
  className?: string
}

export function ResponsiveMenuSubTrigger({ children, className }: ResponsiveMenuSubTriggerProps) {
  const { isSmallScreen } = useResponsiveMenuContext()
  const subTitleContext = React.useContext(ResponsiveMenuSubTitleContext)

  React.useEffect(() => {
    if (isSmallScreen && subTitleContext) {
      subTitleContext.registerTitle(children)
    }
  }, [isSmallScreen, children, subTitleContext])

  if (isSmallScreen) {
    return (
      <Button
        onClick={subTitleContext?.onTriggerClick}
        className={cn('w-full p-6 justify-start text-lg gap-4 [&_svg]:size-5', className)}
        variant="ghost"
      >
        {children}
      </Button>
    )
  }

  return <DropdownMenuSubTrigger className={className}>{children}</DropdownMenuSubTrigger>
}

interface ResponsiveMenuSubContentProps {
  children: React.ReactNode
  className?: string
  showScrollButtons?: boolean
}

export function ResponsiveMenuSubContent({
  children,
  className,
  showScrollButtons
}: ResponsiveMenuSubContentProps) {
  const { isSmallScreen } = useResponsiveMenuContext()
  const subContext = React.useContext(ResponsiveMenuSubContext)

  React.useEffect(() => {
    if (isSmallScreen && subContext) {
      subContext.registerSubContent(children)
    }
  }, [isSmallScreen, children, subContext])

  if (isSmallScreen) {
    return null // Content will be shown via context
  }

  return (
    <DropdownMenuSubContent className={className} showScrollButtons={showScrollButtons}>
      {children}
    </DropdownMenuSubContent>
  )
}
