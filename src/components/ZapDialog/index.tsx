import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks'
import lightning from '@/services/lightning.service'
import { Loader } from 'lucide-react'
import { Dispatch, SetStateAction, useState } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function ZapDialog({
  open,
  setOpen,
  setZapped,
  pubkey,
  eventId
}: {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  setZapped?: Dispatch<SetStateAction<boolean>>
  pubkey: string
  eventId?: string
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex gap-2 items-center">
            <div className="shrink-0">Zap to</div>
            <UserAvatar size="small" userId={pubkey} />
            <Username userId={pubkey} className="truncate flex-1 w-0" />
          </DialogTitle>
        </DialogHeader>
        <ZapDialogContent
          open={open}
          setOpen={setOpen}
          setZapped={setZapped}
          pubkey={pubkey}
          eventId={eventId}
        />
      </DialogContent>
    </Dialog>
  )
}

function ZapDialogContent({
  setOpen,
  setZapped,
  pubkey,
  eventId
}: {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  setZapped?: Dispatch<SetStateAction<boolean>>
  pubkey: string
  eventId?: string
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [sats, setSats] = useState(21)
  const [comment, setComment] = useState('Zap!')
  const [zapping, setZapping] = useState(false)

  const handleZap = async () => {
    try {
      setZapping(true)
      const invoice = await lightning.makeInvoice(pubkey, sats, comment, eventId)
      setOpen(false)
      const zapped = await lightning.zap(invoice)
      setZapped?.(zapped)
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
      {/* Sats slider or input */}
      <div className="flex flex-col items-center">
        <div className="flex justify-center w-full">
          <input
            id="sats"
            value={sats}
            onChange={(e) => {
              setSats((pre) => {
                if (e.target.value === '') {
                  return 0
                }
                let num = parseInt(e.target.value, 10)
                if (isNaN(num) || num < 0) {
                  num = pre
                }
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
        <Label htmlFor="sats">Sats</Label>
      </div>

      {/* Preset sats buttons */}
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

      {/* Comment input */}
      <div>
        <Label htmlFor="comment">Comment</Label>
        <Input id="comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>

      <Button onClick={handleZap}>
        {zapping && <Loader className="animate-spin" />} Zap {sats} sats
      </Button>
    </>
  )
}
