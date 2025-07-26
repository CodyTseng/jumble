import { Card } from '@/components/ui/card'
import { createFakeEvent } from '@/lib/event'
import { cn } from '@/lib/utils'
import Content from '../../Content'

export default function Preview({ content, className }: { content: string; className?: string }) {
  return (
    <Card className={cn('p-3', className)}>
      <Content event={createFakeEvent({ content })} className="pointer-events-none h-full" />
    </Card>
  )
}
