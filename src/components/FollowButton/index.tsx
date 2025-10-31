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

export default function FollowButton({ pubkey, size = 'default' }: { pubkey: string; size?: 'default' | 'sm' }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { followings, follow, unfollow } = useFollowList()
  const [updating, setUpdating] = useState(false)
  const [hover, setHover] = useState(false)
  const isFollowing = useMemo(() => followings.includes(pubkey), [followings, pubkey])

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

  const buttonClass = size === 'sm' ? 'rounded-full min-w-20 h-8 text-xs px-3' : 'rounded-full min-w-28'
  const buttonSize = size === 'sm' ? 'sm' : 'default'

  return isFollowing ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          className={buttonClass}
          size={buttonSize}
          variant={hover ? 'destructive' : 'secondary'}
          disabled={updating}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          aria-label={hover ? t('Unfollow') : t('buttonFollowing')}
          aria-pressed="true"
        >
          {updating ? (
            <Loader className="animate-spin" aria-hidden="true" />
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
    <Button
      className={buttonClass}
      size={buttonSize}
      onClick={handleFollow}
      disabled={updating}
      aria-label={t('Follow')}
      aria-pressed="false"
    >
      {updating ? <Loader className="animate-spin" aria-hidden="true" /> : t('Follow')}
    </Button>
  )
}
