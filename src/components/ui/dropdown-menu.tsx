import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu'
import { Check, ChevronDown, ChevronRight, ChevronUp, Circle } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'

const DropdownMenu = ({
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>) => {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen
  const backdropRef = React.useRef<HTMLDivElement>(null)

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(newOpen)
      }
      controlledOnOpenChange?.(newOpen)
    },
    [isControlled, controlledOnOpenChange]
  )

  React.useEffect(() => {
    if (open) {
      const preventScroll = (e: Event) => e.preventDefault()

      document.addEventListener('wheel', preventScroll, { passive: false })
      document.addEventListener('touchmove', preventScroll, { passive: false })

      return () => {
        document.removeEventListener('wheel', preventScroll)
        document.removeEventListener('touchmove', preventScroll)
      }
    }
  }, [open])

  return (
    <>
      {open &&
        createPortal(
          <div
            ref={backdropRef}
            className="fixed inset-0 z-50 pointer-events-auto"
            onClick={(e) => {
              e.stopPropagation()
              handleOpenChange(false)
            }}
          />,
          document.body
        )}
      <DropdownMenuPrimitive.Root
        {...props}
        open={open}
        onOpenChange={handleOpenChange}
        modal={false}
      />
    </>
  )
}
DropdownMenu.displayName = 'DropdownMenu'

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger

const DropdownMenuGroup = DropdownMenuPrimitive.Group

const DropdownMenuPortal = DropdownMenuPrimitive.Portal

const DropdownMenuSub = DropdownMenuPrimitive.Sub

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup

const DropdownMenuSubTrigger = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      'flex cursor-default gap-2 select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent data-[state=open]:bg-accent [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
      inset && 'pl-8',
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
))
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName

const DropdownMenuSubContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent> & {
    showScrollButtons?: boolean
  }
>(({ className, showScrollButtons = true, ...props }, ref) => {
  const [canScrollUp, setCanScrollUp] = React.useState(false)
  const [canScrollDown, setCanScrollDown] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const scrollAreaRef = React.useRef<HTMLDivElement>(null)

  React.useImperativeHandle(ref, () => contentRef.current!)

  const checkScrollability = React.useCallback(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    setCanScrollUp(scrollArea.scrollTop > 0)
    setCanScrollDown(scrollArea.scrollTop < scrollArea.scrollHeight - scrollArea.clientHeight)
  }, [])

  const scrollUp = () => {
    scrollAreaRef.current?.scroll({ top: 0, behavior: 'smooth' })
  }

  const scrollDown = () => {
    scrollAreaRef.current?.scroll({
      top: scrollAreaRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.SubContent
        ref={contentRef}
        className={cn(
          'relative z-50 min-w-52 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
        )}
        onAnimationEnd={() => {
          if (showScrollButtons) {
            checkScrollability()
          }
        }}
        collisionPadding={10}
        {...props}
      >
        {showScrollButtons && canScrollUp && (
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-center bg-popover">
            <button
              onClick={scrollUp}
              onMouseEnter={scrollUp}
              className="flex items-center justify-center w-full h-6 hover:bg-accent rounded-sm transition-colors"
              type="button"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        )}

        <div
          ref={scrollAreaRef}
          className={cn('p-1 overflow-y-auto scrollbar-hide', className)}
          onScroll={checkScrollability}
        >
          {props.children}
        </div>

        {showScrollButtons && canScrollDown && (
          <div className="absolute bottom-0 inset-x-0 flex items-center justify-center bg-popover">
            <button
              onClick={scrollDown}
              onMouseEnter={scrollDown}
              className="flex items-center justify-center w-full h-6 hover:bg-accent rounded-sm transition-colors"
              type="button"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </DropdownMenuPrimitive.SubContent>
    </DropdownMenuPrimitive.Portal>
  )
})
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName

const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> & {
    showScrollButtons?: boolean
  }
>(({ className, sideOffset = 4, showScrollButtons = false, ...props }, ref) => {
  const [canScrollUp, setCanScrollUp] = React.useState(false)
  const [canScrollDown, setCanScrollDown] = React.useState(false)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const scrollAreaRef = React.useRef<HTMLDivElement>(null)

  React.useImperativeHandle(ref, () => contentRef.current!)

  const checkScrollability = React.useCallback(() => {
    const scrollArea = scrollAreaRef.current
    if (!scrollArea) return

    setCanScrollUp(scrollArea.scrollTop > 0)
    setCanScrollDown(scrollArea.scrollTop < scrollArea.scrollHeight - scrollArea.clientHeight)
  }, [])

  const scrollUp = () => {
    scrollAreaRef.current?.scroll({ top: 0, behavior: 'smooth' })
  }

  const scrollDown = () => {
    scrollAreaRef.current?.scroll({
      top: scrollAreaRef.current.scrollHeight,
      behavior: 'smooth'
    })
  }

  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        ref={contentRef}
        sideOffset={sideOffset}
        className={cn(
          'relative z-50 min-w-52 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2'
        )}
        onAnimationEnd={() => {
          if (showScrollButtons) {
            checkScrollability()
          }
        }}
        collisionPadding={10}
        {...props}
      >
        {showScrollButtons && canScrollUp && (
          <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-center bg-popover">
            <button
              onClick={scrollUp}
              onMouseEnter={scrollUp}
              className="flex items-center justify-center w-full h-6 hover:bg-accent rounded-sm transition-colors"
              type="button"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>
        )}

        <div
          ref={scrollAreaRef}
          className={cn('p-1 overflow-y-auto scrollbar-hide', className)}
          onScroll={checkScrollability}
          onWheel={(e) => e.stopPropagation()}
        >
          {props.children}
        </div>

        {showScrollButtons && canScrollDown && (
          <div className="absolute bottom-0 inset-x-0 flex items-center justify-center bg-popover">
            <button
              onClick={scrollDown}
              onMouseEnter={scrollDown}
              className="flex items-center justify-center w-full h-6 hover:bg-accent rounded-sm transition-colors"
              type="button"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
        )}
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
})
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName

const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-2 px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-md',
      inset && 'pl-8',
      className
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName

const DropdownMenuCheckboxItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    className={cn(
      'relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
))
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName

const DropdownMenuRadioItem = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    className={cn(
      'relative flex cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="h-2 w-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
))
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName

const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn('px-2 py-1.5 text-sm font-semibold', inset && 'pl-8', className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName

const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 my-1 h-px bg-muted', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName

const DropdownMenuShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return <span className={cn('ml-auto text-xs tracking-widest opacity-60', className)} {...props} />
}
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut'

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
}
