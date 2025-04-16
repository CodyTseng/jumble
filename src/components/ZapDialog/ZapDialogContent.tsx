import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks'
import { useNostr } from '@/providers/NostrProvider'
import { useNoteStats } from '@/providers/NoteStatsProvider'
import { useZap } from '@/providers/ZapProvider'
import lightning from '@/services/lightning.service'
import { Loader } from 'lucide-react'
import { Dispatch, SetStateAction, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ZapDialogContent({
  setOpen,
  recipient,
  eventId,
  defaultAmount
}: {
  
  setOpen: Dispatch<SetStateAction<boolean>>
  recipient: string
  eventId?: string
  defaultAmount?: number
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { pubkey } = useNostr()
  const { defaultZapSats, defaultZapComment } = useZap()
  const { addZap } = useNoteStats()
  const [sats, setSats] = useState(defaultAmount ?? defaultZapSats)
  const [comment, setComment] = useState(defaultZapComment)
  const [zapping, setZapping] = useState(false)

  const handleZap = async () => {
    try {
      if (!pubkey) {
        throw new Error('You need to be logged in to zap')
      }
      setZapping(true)
      const zapResult = await lightning.zap(pubkey, recipient, sats, comment, eventId, () =>
        setOpen(false)
      )
      if (!zapResult) return
      if (eventId) {
        addZap(eventId, zapResult.invoice, sats, comment)
      }
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

  return (
    <>
      <div className="flex flex-col items-center">
        <div className="flex justify-center w-full">
          <input
            id="sats"
            value={sats}
            onChange={(e) => {
              setSats((pre) => {
                if (e.target.value === '') return 0
                let num = parseInt(e.target.value, 10)
                if (isNaN(num) || num < 0) return pre
                return num
              })
            }}
            onFocus={(e) => {
              requestAnimationFrame(() => {
                const val = e.target.value
                e.target.setSelectionRange(val.length, val.length)
              })
            }}
            className="bg-transparent text-center w-full p-0 focus-visible:outline-none text-6xl font-bold"
          />
        </div>
        <Label htmlFor="sats">{t('Sats')}</Label>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {[
          { display: '21', val: 21 },
          { display: '66', val: 66 },
          { display: '210', val: 210 },
          { display: '666', val: 666 },
          { display: '1k', val: 1000 },
          { display: '2.1k', val: 2100 },
          { display: '6.6k', val: 6666 },
          { display: '10k', val: 10000 },
          { display: '21k', val: 21000 },
          { display: '66k', val: 66666 },
          { display: '100k', val: 100000 },
          { display: '210k', val: 210000 }
        ].map(({ display, val }) => (
          <Button variant="secondary" key={val} onClick={() => setSats(val)}>
            {display}
          </Button>
        ))}
      </div>

      <div>
        <Label htmlFor="comment">{t('zapComment')}</Label>
        <Input id="comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>

      <Button onClick={handleZap}>
        {zapping && <Loader className="animate-spin" />} {t('Zap n sats', { n: sats })}
      </Button>
    </>
  )
}
