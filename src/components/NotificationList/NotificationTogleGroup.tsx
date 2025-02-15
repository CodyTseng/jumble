import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Heart, MessageCircle, Repeat, Zap } from 'lucide-react'

export function NotificationToggleGroup({
  displayTypes,
  setDisplayTypes
}: {
  displayTypes: string[]
  setDisplayTypes: (types: string[]) => void
}) {
  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      className="justify-start mb-2"
      value={displayTypes}
      onValueChange={setDisplayTypes}
    >
      <ToggleGroupItem value="like" className="data-[state=on]:text-red-400">
        <Heart />
      </ToggleGroupItem>
      <ToggleGroupItem value="repost" className="data-[state=on]:text-green-400">
        <Repeat />
      </ToggleGroupItem>
      <ToggleGroupItem value="comment" className="data-[state=on]:text-blue-400">
        <MessageCircle />
      </ToggleGroupItem>
      <ToggleGroupItem value="zap" className="data-[state=on]:text-yellow-400">
        <Zap />
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
