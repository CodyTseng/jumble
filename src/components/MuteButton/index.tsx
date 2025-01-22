import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function MuteButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { mutePubkeys, mutePubkey, unmutePubkey } = useMuteList()
  const [updating, setUpdating] = useState(false)
  const isMuted = useMemo(() => mutePubkeys.includes(pubkey), [mutePubkeys, pubkey])

  if (!accountPubkey || (pubkey && pubkey === accountPubkey)) return null

  const handleMute = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isMuted) return

      setUpdating(true)
      try {
        await mutePubkey(pubkey)
      } catch (error) {
        toast({
          title: t('Mute failed'),
          description: (error as Error).message,
          variant: 'destructive'
        })
      } finally {
        setUpdating(false)
      }
    })
  }

  const handleUnmute = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!isMuted) return

      setUpdating(true)
      try {
        await unmutePubkey(pubkey)
      } catch (error) {
        toast({
          title: t('Unmute failed'),
          description: (error as Error).message,
          variant: 'destructive'
        })
      } finally {
        setUpdating(false)
      }
    })
  }

  return isMuted ? (
    <Button
      className="w-20 min-w-20 rounded-full"
      variant="secondary"
      onClick={handleUnmute}
      disabled={updating}
    >
      {updating ? <Loader className="animate-spin" /> : t('Unmute')}
    </Button>
  ) : (
    <Button
      variant="destructive"
      className="w-20 min-w-20 rounded-full"
      onClick={handleMute}
      disabled={updating}
    >
      {updating ? <Loader className="animate-spin" /> : t('Mute')}
    </Button>
  )
}
