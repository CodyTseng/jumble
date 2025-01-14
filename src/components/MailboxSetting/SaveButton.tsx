import { useToast } from '@/hooks'
import { useNostr } from '@/providers/NostrProvider'
import dayjs from 'dayjs'
import { CloudUpload, Loader } from 'lucide-react'
import { kinds } from 'nostr-tools'
import { useState } from 'react'
import { Button } from '../ui/button'
import { TMailboxRelay } from './types'

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
    const event = {
      kind: kinds.RelayList,
      content: '',
      tags: mailboxRelays.map(({ url, scope }) =>
        scope === 'both' ? ['r', url] : ['r', url, scope]
      ),
      created_at: dayjs().unix()
    }
    const relayListEvent = await publish(event)
    updateRelayListEvent(relayListEvent)
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
