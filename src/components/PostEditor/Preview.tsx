import { Card } from '@/components/ui/card'
import { createFakeEvent } from '@/lib/event'
import Content from '../Content'

export default function Preview({ content }: { content: string }) {
  return (
    <Card className="p-3 min-h-52">
      <Content event={createFakeEvent({ content })} className="pointer-events-none h-full" />
    </Card>
  )
}
