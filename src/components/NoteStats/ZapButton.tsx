import { ACTUAL_ZAP_SOUNDS, ZAP_SOUNDS } from '@/constants'
import { useNoteStatsById } from '@/hooks/useNoteStatsById'
import { getLightningAddressFromProfile } from '@/lib/lightning'
import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useZap } from '@/providers/ZapProvider'
import client from '@/services/client.service'
import lightning from '@/services/lightning.service'
import noteStatsService from '@/services/note-stats.service'
import { Loader, Zap } from 'lucide-react'
import { Event } from 'nostr-tools'
import { MouseEvent, TouchEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ZapDialog from '../ZapDialog'

export default function ZapButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { checkLogin, pubkey } = useNostr()
  const noteStats = useNoteStatsById(event.id)
  const { defaultZapSats, defaultZapComment, quickZap, zapSound } = useZap()
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [openZapDialog, setOpenZapDialog] = useState(false)
  const [zapping, setZapping] = useState(false)
  const { zapAmount, hasZapped } = useMemo(() => {
    return {
      zapAmount: noteStats?.zaps?.reduce((acc, zap) => acc + zap.amount, 0),
      hasZapped: pubkey ? noteStats?.zaps?.some((zap) => zap.pubkey === pubkey) : false
    }
  }, [noteStats, pubkey])
  const [disable, setDisable] = useState(true)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPressRef = useRef(false)

  useEffect(() => {
    client.fetchProfile(event.pubkey).then((profile) => {
      if (!profile) return
      if (pubkey === profile.pubkey) return
      const lightningAddress = getLightningAddressFromProfile(profile)
      if (lightningAddress) setDisable(false)
    })
  }, [event])

  const handleZap = async () => {
    try {
      if (!pubkey) {
        throw new Error('You need to be logged in to zap')
      }
      if (zapping) return

      // Play zap sound IMMEDIATELY when button is pressed
      if (zapSound !== ZAP_SOUNDS.NONE) {
        let soundToPlay = zapSound
        // If random is selected, pick a random sound
        if (zapSound === ZAP_SOUNDS.RANDOM) {
          const randomIndex = Math.floor(Math.random() * ACTUAL_ZAP_SOUNDS.length)
          soundToPlay = ACTUAL_ZAP_SOUNDS[randomIndex]
        }
        const audio = new Audio(`/sounds/${soundToPlay}.mp3`)
        audio.volume = 0.5
        audio.play().catch(() => {
          // Ignore errors (e.g., autoplay policy restrictions)
        })
      }

      setZapping(true)
      const zapResult = await lightning.zap(pubkey, event, defaultZapSats, defaultZapComment)
      // user canceled
      if (!zapResult) {
        return
      }
      noteStatsService.addZap(
        pubkey,
        event.id,
        zapResult.invoice,
        defaultZapSats,
        defaultZapComment
      )
    } catch (error) {
      toast.error(`${t('Zap failed')}: ${(error as Error).message}`)
    } finally {
      setZapping(false)
    }
  }

  const handleClickStart = (e: MouseEvent | TouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (disable) return

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
    if (disable) return

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
          'flex items-center gap-1 select-none px-3 h-full',
          hasZapped ? 'text-primary' : 'text-muted-foreground',
          disable
            ? 'cursor-not-allowed text-muted-foreground/40'
            : 'cursor-pointer enabled:hover:text-primary'
        )}
        title={t('Zap')}
        disabled={disable || zapping}
        onMouseDown={handleClickStart}
        onMouseUp={handleClickEnd}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleClickStart}
        onTouchEnd={handleClickEnd}
      >
        {zapping ? (
          <Loader className="animate-spin" />
        ) : (
          <Zap className={hasZapped ? 'fill-primary' : ''} />
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
        event={event}
      />
    </>
  )
}

function formatAmount(amount: number) {
  if (amount < 1000) return amount
  if (amount < 1000000) return `${Math.round(amount / 100) / 10}k`
  return `${Math.round(amount / 100000) / 10}M`
}
