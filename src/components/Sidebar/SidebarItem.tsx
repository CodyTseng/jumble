import { Button, ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const SidebarItem = forwardRef<
  HTMLButtonElement,
  ButtonProps & { title: string; description?: string }
>(({ children, title, description, className, ...props }, ref) => {
  const { t } = useTranslation()

  return (
    <Button
      className={cn(
        'flex shadow-none items-center bg-transparent clickable text-foreground hover:text-accent-foreground w-12 h-12 xl:w-full xl:h-auto p-3 m-0 xl:py-2 xl:px-4 rounded-lg xl:justify-start gap-4 text-lg font-semibold [&_svg]:size-full xl:[&_svg]:size-4',
        className
      )}
      variant="ghost"
      title={t(title)}
      ref={ref}
      {...props}
    >
      {children}
      <div className="max-xl:hidden">{t(description ?? title)}</div>
    </Button>
  )
})
SidebarItem.displayName = 'SidebarItem'
export default SidebarItem
