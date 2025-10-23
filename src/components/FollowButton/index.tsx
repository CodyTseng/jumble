import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function FollowButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { followingSet, follow, unfollow } = useFollowList()
  const [updating, setUpdating] = useState(false)
  const [hover, setHover] = useState(false)
  const isFollowing = useMemo(() => followingSet.has(pubkey), [followingSet, pubkey])

  if (!accountPubkey || (pubkey && pubkey === accountPubkey)) return null

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isFollowing) return

      setUpdating(true)
      try {
        await follow(pubkey)
      } catch (error) {
        toast.error(t('Follow failed') + ': ' + (error as Error).message)
      } finally {
        setUpdating(false)
      }
    })
  }

  const handleUnfollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!isFollowing) return

      setUpdating(true)
      try {
        await unfollow(pubkey)
      } catch (error) {
        toast.error(t('Unfollow failed') + ': ' + (error as Error).message)
      } finally {
        setUpdating(false)
      }
    })
  }

  return isFollowing ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className="rounded-full min-w-28"
          variant={hover ? 'destructive' : 'secondary'}
          disabled={updating}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          {updating ? (
            <Loader className="animate-spin" />
          ) : hover ? (
            t('Unfollow')
          ) : (
            t('buttonFollowing')
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Unfollow')}?</AlertDialogTitle>
          <AlertDialogDescription>
            {t('Are you sure you want to unfollow this user?')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleUnfollow} variant="destructive">
            {t('Unfollow')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : (
    <Button className="rounded-full min-w-28" onClick={handleFollow} disabled={updating}>
      {updating ? <Loader className="animate-spin" /> : t('Follow')}
    </Button>
  )
}
