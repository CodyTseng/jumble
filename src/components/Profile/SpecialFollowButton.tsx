import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import { usePinnedUsers } from '@/providers/PinnedUsersProvider'
import { Loader, Star } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function SpecialFollowButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { isPinned, togglePin } = usePinnedUsers()
  const [updating, setUpdating] = useState(false)
  const pinned = useMemo(() => isPinned(pubkey), [isPinned, pubkey])

  if (!accountPubkey || (pubkey && pubkey === accountPubkey)) return null

  const onToggle = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      setUpdating(true)
      try {
        await togglePin(pubkey)
      } catch (error) {
        if (pinned) {
          toast.error(t('Unfollow failed') + ': ' + (error as Error).message)
        } else {
          toast.error(t('Follow failed') + ': ' + (error as Error).message)
        }
      } finally {
        setUpdating(false)
      }
    })
  }

  return (
    <Button
      variant="secondary"
      size="icon"
      className="rounded-full"
      onClick={onToggle}
      disabled={updating}
    >
      {updating ? (
        <Loader className="animate-spin" />
      ) : (
        <Star className={pinned ? 'fill-primary stroke-primary' : ''} />
      )}
    </Button>
  )
}
