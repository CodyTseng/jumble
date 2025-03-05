import { useToast } from '@/hooks'
import { getLightningAddressFromProfile } from '@/lib/lightning'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import { useZap } from '@/providers/ZapProvider'
import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import { Loader, Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { MouseEvent, TouchEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ZapDialog from '../ZapDialog'

export default function ZapButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { checkLogin, pubkey } = useNostr()
  const { noteStatsMap, addZap } = useNoteStats()
  const { defaultZapSats, defaultZapComment, quickZap } = useZap()
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [openZapDialog, setOpenZapDialog] = useState(false)
  const [zapping, setZapping] = useState(false)
  const { zapAmount, hasZapped } = useMemo(() => {
    const stats = noteStatsMap.get(event.id) || {}
    return {
      zapAmount: stats.zaps?.reduce((acc, zap) => acc + zap.amount, 0),
      hasZapped: pubkey ? stats.zaps?.some((zap) => zap.pubkey === pubkey) : false
    }
  }, [noteStatsMap, event, pubkey])
  const [showButton, setShowButton] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)

  useEffect(() => {
    client.fetchProfile(event.pubkey).then((profile) => {
      if (!profile) return
      const lightningAddress = getLightningAddressFromProfile(profile)
      if (lightningAddress) setShowButton(true)
    })
  }, [event])

  if (!showButton) return null

  const handleZap = async () => {
    try {
      if (!pubkey) {
        throw new Error('You need to be logged in to zap')
      }
      setZapping(true)
      const { invoice } = await lightning.zap(
        pubkey,
        event.pubkey,
        defaultZapSats,
        defaultZapComment,
        event.id
      )
      addZap(event.id, invoice, defaultZapSats, defaultZapComment)
    } catch (error) {
      toast({
        title: t('Zap failed'),
        description: (error as Error).message,
        variant: 'destructive'
      })
    } finally {
      setZapping(false)
    }
  }

  const handleClickStart = (e: MouseEvent | TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    isLongPressRef.current = false

    if ('touches' in e) {
      const touch = e.touches[0]
      setTouchStart({ x: touch.clientX, y: touch.clientY })
    }

    if (quickZap) {
      timerRef.current = setTimeout(() => {
        isLongPressRef.current = true
        checkLogin(() => {
          setOpenZapDialog(true)
          setZapping(true)
        })
      }, 500)
    }
  }

  const handleClickEnd = (e: MouseEvent | TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }

    if ('touches' in e) {
      setTouchStart(null)
      if (!touchStart) return
      const touch = e.changedTouches[0]
      const diffX = Math.abs(touch.clientX - touchStart.x)
      const diffY = Math.abs(touch.clientY - touchStart.y)
      if (diffX > 10 || diffY > 10) return
    }

    if (!quickZap) {
      checkLogin(() => {
        setOpenZapDialog(true)
        setZapping(true)
      })
    } else if (!isLongPressRef.current) {
      checkLogin(() => handleZap())
    }
    isLongPressRef.current = false
  }

  const handleMouseLeave = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
  }

  return (
    <>
      <button
        className={cn(
          'flex items-center enabled:hover:text-yellow-400 gap-1 select-none px-3 h-full',
          hasZapped ? 'text-yellow-400' : 'text-muted-foreground'
        )}
        title={t('Zap')}
        onMouseDown={handleClickStart}
        onMouseUp={handleClickEnd}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleClickStart}
        onTouchEnd={handleClickEnd}
      >
        {zapping ? (
          <Loader className="animate-spin" />
        ) : (
          <Zap className={hasZapped ? 'fill-yellow-400' : ''} />
        )}
        {!!zapAmount && <div className="text-sm">{formatAmount(zapAmount)}</div>}
      </button>
      <ZapDialog
        open={openZapDialog}
        setOpen={(open) => {
          setOpenZapDialog(open)
          setZapping(open)
        }}
        pubkey={event.pubkey}
        eventId={event.id}
      />
    </>
  )
}

function formatAmount(amount: number) {
  if (amount < 1000) return amount
  if (amount < 1000000) return `${Math.round(amount / 100) / 10}k`
  return `${Math.round(amount / 100000) / 10}M`
}
