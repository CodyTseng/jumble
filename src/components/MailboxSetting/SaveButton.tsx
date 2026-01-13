import { Button } from '@/components/ui/button'
import { createRelayListDraftEvent } from '@/lib/draft-event'
import { useNostr } from '@/providers/NostrProvider'
import { TMailboxRelay } from '@/types'
import { CloudUpload, Loader } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function SaveButton({
  mailboxRelays,
  hasChange,
  setHasChange
}: {
  mailboxRelays: TMailboxRelay[]
  hasChange: boolean
  setHasChange: (hasChange: boolean) => void
}) {
  const { t } = useTranslation()
  const { pubkey, publish, updateRelayListEvent } = useNostr()
  const [pushing, setPushing] = useState(false)

  const save = async () => {
    if (!pubkey) return

    setPushing(true)
    const event = createRelayListDraftEvent(mailboxRelays)
    const relayListEvent = await publish(event)
    await updateRelayListEvent(relayListEvent)
    toast.success('Successfully saved mailbox relays')
    setHasChange(false)
    setPushing(false)
  }

  return (
    <Button className="w-full" disabled={!pubkey || pushing || !hasChange} onClick={save}>
      {pushing ? <Loader className="animate-spin" /> : <CloudUpload />}
      {t('Save')}
    </Button>
  )
}
