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
        'flex shadow-none items-center transition-colors duration-500 bg-transparent m-0 rounded-lg gap-4 text-lg font-semibold',
        collapse
          ? 'w-12 h-12 p-3 [&_svg]:size-full'
          : 'justify-start w-full h-auto py-2 px-3 [&_svg]:size-5',
        active && 'text-primary hover:text-primary bg-primary/10 hover:bg-primary/10',
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
