import { cn } from '@/lib/utils'
import { CheckCircle2, Info, TriangleAlert } from 'lucide-react'

const ICON_MAP = {
  info: <Info />,
  success: <CheckCircle2 />,
  alert: <TriangleAlert />
}

const VARIANT_STYLES = {
  info: 'bg-blue-100/20 dark:bg-blue-950/20 border border-blue-500 text-blue-500',
  success: 'bg-green-100/20 dark:bg-green-950/20 border border-green-500 text-green-500',
  alert: 'bg-amber-100/20 dark:bg-amber-950/20 border border-amber-500 text-amber-500'
}

export default function InfoCard({
  title,
  content,
  icon,
  variant = 'info'
}: {
  title: string
  content?: string
  icon?: React.ReactNode
  variant?: 'info' | 'success' | 'alert'
}) {
  return (
    <div className={cn('p-3 rounded-lg text-sm [&_svg]:size-4', VARIANT_STYLES[variant])}>
      <div className="flex items-center gap-2">
        {icon ?? ICON_MAP[variant]}
        <div className="font-medium">{title}</div>
      </div>
      {content && <div className="pl-6">{content}</div>}
    </div>
  )
}
