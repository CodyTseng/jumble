import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { JUMBLE_PUBKEY } from '@/constants'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import lightning from '@/services/lightning.service'
import { Loader } from 'lucide-react'
import { Dispatch, SetStateAction, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export const DONATION_PRESETS = [
  { amount: 1000, emoji: '☕️', display: '1k' },
  { amount: 10000, emoji: '🍜', display: '10k' },
  { amount: 100000, emoji: '🍣', display: '100k' },
  { amount: 1000000, emoji: '✈️', display: '1M' }
] as const

export default function DonationDialog({
  open,
  setOpen,
  defaultAmount,
  onDonated
}: {
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  defaultAmount?: number
  onDonated?: () => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="flex flex-col gap-4 px-4">
          <div className="grid gap-1.5 p-4 text-center sm:text-start">
            <DrawerTitle className="flex items-center gap-2">
              <div className="shrink-0">{t('Donate to')}</div>
              <UserAvatar size="small" userId={JUMBLE_PUBKEY} />
              <Username userId={JUMBLE_PUBKEY} className="h-5 w-0 flex-1 truncate text-start" />
            </DrawerTitle>
          </div>
          <DonationDialogContent
            setOpen={setOpen}
            defaultAmount={defaultAmount}
            onDonated={onDonated}
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="shrink-0">{t('Donate to')}</div>
            <UserAvatar size="small" userId={JUMBLE_PUBKEY} />
            <Username userId={JUMBLE_PUBKEY} className="h-5 max-w-fit flex-1 truncate text-start" />
          </DialogTitle>
        </DialogHeader>
        <DonationDialogContent
          setOpen={setOpen}
          defaultAmount={defaultAmount}
          onDonated={onDonated}
        />
      </DialogContent>
    </Dialog>
  )
}

function DonationDialogContent({
  setOpen,
  defaultAmount,
  onDonated
}: {
  setOpen: Dispatch<SetStateAction<boolean>>
  defaultAmount?: number
  onDonated?: () => void
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [sats, setSats] = useState(defaultAmount ?? DONATION_PRESETS[0].amount)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const isSelfDonation = pubkey === JUMBLE_PUBKEY

  const handleDonate = async () => {
    try {
      if (!pubkey) {
        throw new Error(t('You need to be logged in to zap'))
      }
      if (sats <= 0) {
        return
      }
      setSending(true)
      const result = await lightning.zap(pubkey, JUMBLE_PUBKEY, sats, comment, () => setOpen(false))
      if (!result) {
        return
      }
      toast.success(t('Thank you for supporting Jumble! 💛'))
      onDonated?.()
    } catch (error) {
      toast.error(`${t('Donation failed')}: ${(error as Error).message}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <div className="flex flex-col items-center">
        <div className="flex w-full justify-center">
          <input
            id="donation-sats"
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
            className="w-full bg-transparent p-0 text-center text-6xl font-bold focus-visible:outline-hidden"
          />
        </div>
        <Label htmlFor="donation-sats">{t('Sats')}</Label>
      </div>

      {isSelfDonation && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-center text-sm text-yellow-600 dark:border-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-400">
          {t('selfZapWarning')}
        </div>
      )}

      <div className="grid grid-cols-4 gap-2">
        {DONATION_PRESETS.map(({ amount, emoji, display }) => (
          <Button
            key={amount}
            variant={sats === amount ? 'default' : 'secondary'}
            onClick={() => setSats(amount)}
          >
            <span>{emoji}</span>
            <span className="tabular-nums">{display}</span>
          </Button>
        ))}
      </div>

      <div>
        <Label htmlFor="donation-comment">{t('Leave a message (optional)')}</Label>
        <Textarea
          id="donation-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t('Say hi or share what you love about Jumble')}
          maxLength={280}
          rows={3}
        />
      </div>

      <Button onClick={handleDonate} disabled={sending || sats <= 0}>
        {sending && <Loader className="animate-spin" />}
        {t('Donate n sats', { n: sats })}
      </Button>

      {sats >= 1000 && (
        <div className="text-muted-foreground text-center text-xs">
          {t('Your donation will appear in Recent Supporters')}
        </div>
      )}
    </>
  )
}
