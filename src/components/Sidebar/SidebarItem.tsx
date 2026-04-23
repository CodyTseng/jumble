import { Button, ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const SidebarItem = forwardRef<
  HTMLButtonElement,
  ButtonProps & { title: string; collapse: boolean; description?: string; active?: boolean }
>(({ children, title, description, className, active, collapse, ...props }, ref) => {
  const { t } = useTranslation()

  return (
    <Button
      className={cn(
        'm-0 flex items-center gap-4 rounded-lg bg-transparent text-lg font-semibold shadow-none transition-colors duration-500',
        collapse
          ? 'h-12 w-12 p-3 [&_svg]:size-6'
          : 'h-auto w-full justify-start px-3 py-2 [&_svg]:size-5',
        active && 'bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
        className
      )}
      variant="ghost"
      title={t(title)}
      ref={ref}
      {...props}
    >
      {children}
      {!collapse && <div>{t(description ?? title)}</div>}
    </Button>
  )
})
SidebarItem.displayName = 'SidebarItem'
export default SidebarItem
