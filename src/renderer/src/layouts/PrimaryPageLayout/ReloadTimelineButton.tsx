import { TitlebarButton } from '@renderer/components/Titlebar'
import { createReloadTimelineEvent, eventBus } from '@renderer/services/event-bus.service'
import { Eraser } from 'lucide-react'

export default function ReloadTimelineButton() {
  return (
    <TitlebarButton
      onClick={() => eventBus.emit(createReloadTimelineEvent())}
      title="reload timeline"
    >
      <Eraser />
    </TitlebarButton>
  )
}
