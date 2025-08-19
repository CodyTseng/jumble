import { Button } from '@/components/ui/button'
import { normalizeUrl } from '@/lib/url'
import { useNostr } from '@/providers/NostrProvider'
import { TMailboxRelay, TMailboxRelayScope } from '@/types'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import MailboxRelay from './MailboxRelay'
import NewMailboxRelayInput from './NewMailboxRelayInput'
import RelayCountWarning from './RelayCountWarning'
import SaveButton from './SaveButton'

export default function MailboxSetting() {
  const { t } = useTranslation()
  const { pubkey, relayList, checkLogin } = useNostr()
  const [relays, setRelays] = useState<TMailboxRelay[]>([])
  const [hasChange, setHasChange] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = relays.findIndex((relay) => relay.url === active.id)
      const newIndex = relays.findIndex((relay) => relay.url === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        setRelays((relays) => arrayMove(relays, oldIndex, newIndex))
        setHasChange(true)
      }
    }
  }

  useEffect(() => {
    if (!relayList) return

    setRelays(relayList.originalRelays)
  }, [relayList])

  if (!pubkey) {
    return (
      <div className="flex flex-col w-full items-center">
        <Button size="lg" onClick={() => checkLogin()}>
          {t('Login to set')}
        </Button>
      </div>
    )
  }

  if (!relayList) {
    return <div className="text-center text-sm text-muted-foreground">{t('loading...')}</div>
  }

  const changeMailboxRelayScope = (url: string, scope: TMailboxRelayScope) => {
    setRelays((prev) => prev.map((r) => (r.url === url ? { ...r, scope } : r)))
    setHasChange(true)
  }

  const removeMailboxRelay = (url: string) => {
    setRelays((prev) => prev.filter((r) => r.url !== url))
    setHasChange(true)
  }

  const saveNewMailboxRelay = (url: string) => {
    if (url === '') return null
    const normalizedUrl = normalizeUrl(url)
    if (!normalizedUrl) {
      return t('Invalid relay URL')
    }
    if (relays.some((r) => r.url === normalizedUrl)) {
      return t('Relay already exists')
    }
    setRelays([...relays, { url: normalizedUrl, scope: 'both' }])
    setHasChange(true)
    return null
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground space-y-1">
        <div>{t('read relays description')}</div>
        <div>{t('write relays description')}</div>
        <div>{t('read & write relays notice')}</div>
      </div>
      <RelayCountWarning relays={relays} />
      <SaveButton mailboxRelays={relays} hasChange={hasChange} setHasChange={setHasChange} />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext items={relays.map((r) => r.url)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {relays.map((relay) => (
              <MailboxRelay
                key={relay.url}
                mailboxRelay={relay}
                changeMailboxRelayScope={changeMailboxRelayScope}
                removeMailboxRelay={removeMailboxRelay}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <NewMailboxRelayInput saveNewMailboxRelay={saveNewMailboxRelay} />
    </div>
  )
}
