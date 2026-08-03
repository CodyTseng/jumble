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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useFollowList } from '@/providers/FollowListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { ChevronDown, Loader, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const {
    followingSet,
    follow,
    followPrivately,
    unfollow,
    getFollowType,
    switchToPrivateFollow,
    switchToPublicFollow
  } = useFollowList()
  const [updating, setUpdating] = useState(false)
  const [hover, setHover] = useState(false)
  const isFollowing = useMemo(() => followingSet.has(pubkey), [followingSet, pubkey])
  const followType = useMemo(() => getFollowType(pubkey), [getFollowType, pubkey])

  if (!accountPubkey || (pubkey && pubkey === accountPubkey)) return null

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isFollowing) return
      setUpdating(true)
      await follow(pubkey)
      setUpdating(false)
    })
  }

  const handleFollowPrivately = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isFollowing) return
      setUpdating(true)
      await followPrivately(pubkey)
      setUpdating(false)
    })
  }

  const handleUnfollow = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!isFollowing) return
      setUpdating(true)
      await unfollow(pubkey)
      setUpdating(false)
    })
  }

  if (isFollowing) {
    return (
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className="min-w-28 rounded-full"
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
                <span className="inline-flex items-center gap-1">
                  {followType === 'private' && <Lock className="h-3.5 w-3.5" />}
                  {followType === 'private' ? t('Following privately') : t('buttonFollowing')}
                </span>
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="rounded-full" disabled={updating}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {followType === 'public' && (
              <DropdownMenuItem
                onClick={() =>
                  checkLogin(async () => {
                    setUpdating(true)
                    await switchToPrivateFollow(pubkey)
                    setUpdating(false)
                  })
                }
              >
                <Lock className="mr-2 h-4 w-4" />
                {t('Make follow private')}
              </DropdownMenuItem>
            )}
            {followType === 'private' && (
              <DropdownMenuItem
                onClick={() =>
                  checkLogin(async () => {
                    setUpdating(true)
                    await switchToPublicFollow(pubkey)
                    setUpdating(false)
                  })
                }
              >
                {t('Make follow public')}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <Button className="min-w-28 rounded-full" onClick={handleFollow} disabled={updating}>
        {updating ? <Loader className="animate-spin" /> : t('Follow')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" className="rounded-full" disabled={updating}>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleFollowPrivately}>
            <Lock className="mr-2 h-4 w-4" />
            {t('Follow privately')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
