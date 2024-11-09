import { Card } from '@renderer/components/ui/card'
import dayjs from 'dayjs'
import Content from '../Content'

export default function Preview({ content }: { content: string }) {
  return (
    <Card className="p-3">
      <Content
        event={{
          content,
          kind: 1,
          tags: [],
          created_at: dayjs().unix(),
          id: '',
          pubkey: '',
          sig: ''
        }}
      />
    </Card>
  )
}
