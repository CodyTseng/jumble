import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import { usePinList } from '@/providers/PinListProvider'
import { Loader, Pin } from 'lucide-react'
import { NostrEvent } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function PinnedButton({ event }: { event: NostrEvent }) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { unpin } = usePinList()
  const [hovered, setHovered] = useState(false)
  const [unpinning, setUnpinning] = useState(false)

  if (event.pubkey !== pubkey) {
    return (
      <div className="flex gap-1 text-sm items-center text-primary mb-1 px-4 py-0 h-fit">
        <Pin size={16} className="shrink-0" />
        {t('Pinned')}
      </div>
    )
  }

  return (
    <Button
      className="flex gap-1 text-sm text-primary items-center mb-1 px-4 py-0.5 h-fit"
      variant="link"
      onClick={(e) => {
        e.stopPropagation()
        setUnpinning(true)
        unpin(event).finally(() => setUnpinning(false))
      }}
      disabled={unpinning}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {unpinning ? (
        <Loader size={16} className="animate-spin shrink-0" />
      ) : (
        <Pin size={16} className="shrink-0" />
      )}
      {unpinning ? t('Unpinning') : hovered ? t('Unpin') : t('Pinned')}
    </Button>
  )
}
