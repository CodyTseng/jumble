import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { followListEvent, followings, isFetching, follow, unfollow } = useFollowList()
  const [updating, setUpdating] = useState(false)
  const isFollowing = useMemo(() => followings.includes(pubkey), [followings, pubkey])

  if (!accountPubkey || isFetching || (pubkey && pubkey === accountPubkey)) return null

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isFollowing) return

      setUpdating(true)
      try {
        await follow(pubkey)
      } catch (error) {
        toast({
          title: t('Follow failed'),
          description: (error as Error).message,
          variant: 'destructive'
        })
      } finally {
        setUpdating(false)
      }
    })
  }

  const handleUnfollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!isFollowing || !followListEvent) return

      setUpdating(true)
      try {
        await unfollow(pubkey)
      } catch (error) {
        toast({
          title: t('Unfollow failed'),
          description: (error as Error).message,
          variant: 'destructive'
        })
      } finally {
        setUpdating(false)
      }
    })
  }

  return isFollowing ? (
    <Button
      className="w-20 min-w-20 rounded-full"
      variant="secondary"
      onClick={handleUnfollow}
      disabled={updating}
    >
      {updating ? <Loader className="animate-spin" /> : t('Unfollow')}
    </Button>
  ) : (
    <Button className="w-20 min-w-20 rounded-full" onClick={handleFollow} disabled={updating}>
      {updating ? <Loader className="animate-spin" /> : t('Follow')}
    </Button>
  )
}
