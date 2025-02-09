import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { Loader, Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ZapDialog from '../ZapDialog'

export default function ZapButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { checkLogin } = useNostr()
  const [hasZapped, setHasZapped] = useState(false)
  const [zapping, setZapping] = useState(false)
  const canZap = !hasZapped

  return (
    <>
      <button
        className={cn(
          'flex items-center enabled:hover:text-yellow-400 gap-1',
          hasZapped ? 'text-yellow-400' : 'text-muted-foreground'
        )}
        onClick={() => checkLogin(() => setZapping(true))}
        disabled={!canZap}
        title={t('Zap')}
      >
        {zapping ? (
          <Loader className="animate-spin" size={16} />
        ) : (
          <Zap size={16} className={hasZapped ? 'fill-yellow-400' : ''} />
        )}
      </button>
      <ZapDialog
        open={zapping}
        setOpen={setZapping}
        setZapped={setHasZapped}
        pubkey={event.pubkey}
        eventId={event.id}
      />
    </>
  )
}
