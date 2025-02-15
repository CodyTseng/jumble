import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import { Loader, Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ZapDialog from '../ZapDialog'

export default function ZapButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { checkLogin, pubkey } = useNostr()
  const { noteStatsMap } = useNoteStats()
  const [zapping, setZapping] = useState(false)
  const { zapAmount, hasZapped } = useMemo(() => {
    const stats = noteStatsMap.get(event.id) || {}
    return {
      zapAmount: stats.zaps?.reduce((acc, zap) => acc + zap.amount, 0),
      hasZapped: pubkey ? stats.zaps?.some((zap) => zap.pubkey === pubkey) : false
    }
  }, [noteStatsMap, event, pubkey])

  return (
    <>
      <button
        className={cn(
          'flex items-center enabled:hover:text-yellow-400 gap-1',
          hasZapped ? 'text-yellow-400' : 'text-muted-foreground'
        )}
        onClick={() => checkLogin(() => setZapping(true))}
        title={t('Zap')}
      >
        {zapping ? (
          <Loader className="animate-spin" size={16} />
        ) : (
          <Zap size={16} className={hasZapped ? 'fill-yellow-400' : ''} />
        )}
        {!!zapAmount && <div className="text-sm">{formatAmount(zapAmount)}</div>}
      </button>
      <ZapDialog open={zapping} setOpen={setZapping} pubkey={event.pubkey} eventId={event.id} />
    </>
  )
}

function formatAmount(amount: number) {
  if (amount < 1000) return amount
  if (amount < 1000000) return `${Math.round(amount / 100) / 10}k`
  return `${Math.round(amount / 100000) / 10}M`
}
