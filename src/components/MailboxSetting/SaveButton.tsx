import { useToast } from '@/hooks'
import { createRelayListDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import { TMailboxRelay } from '@/types'
import { CloudUpload, Loader } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../ui/button'

export default function SaveButton({
  mailboxRelays,
  hasChange,
  setHasChange
}: {
  mailboxRelays: TMailboxRelay[]
  hasChange: boolean
  setHasChange: (hasChange: boolean) => void
}) {
  const { toast } = useToast()
  const { pubkey, publish, updateRelayListEvent } = useNostr()
  const [pushing, setPushing] = useState(false)

  const save = async () => {
    if (!pubkey) return

    setPushing(true)
    const event = createRelayListDraftEvent(mailboxRelays)
    const relayListEvent = await publish(event)
    await updateRelayListEvent(relayListEvent)
    toast({
      title: 'Save Successful',
      description: 'Successfully saved mailbox relays'
    })
    setHasChange(false)
    setPushing(false)
  }

  return (
    <Button className="w-full" disabled={!pubkey || pushing || !hasChange} onClick={save}>
      {pushing ? <Loader className="animate-spin" /> : <CloudUpload />}
      Save
    </Button>
  )
}
