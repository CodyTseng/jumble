import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'
import { Components } from 'react-markdown'

// remark-gfm renders task lists as <li class="task-list-item"><input type="checkbox" disabled>,
// but the global CSS strips checkbox appearance. Render a styled read-only checkbox instead.
export const taskListMarkdownComponents: Pick<Components, 'input' | 'li'> = {
  input: ({ type, checked, ...props }) => {
    if (type !== 'checkbox') return <input type={type} {...props} />
    return (
      <span
        role="checkbox"
        aria-checked={checked}
        aria-readonly
        className={cn(
          'me-1.5 -ms-6 inline-flex size-4 translate-y-0.5 items-center justify-center rounded border',
          checked
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/50'
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3} />}
      </span>
    )
  },
  li: ({ className, children, ...props }) => (
    <li
      className={cn(className, className?.includes('task-list-item') && 'list-none')}
      {...props}
    >
      {children}
    </li>
  )
}
