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
import { ChevronDown, Eye, EyeOff, Loader, Lock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowButton({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { followingSet, isPrivateFollowing, follow, unfollow, moveToPrivate, moveToPublic } =
    useFollowList()
  const [updating, setUpdating] = useState(false)
  const [hover, setHover] = useState(false)
  const isFollowing = useMemo(() => followingSet.has(pubkey), [followingSet, pubkey])
  const isPrivate = useMemo(() => isPrivateFollowing(pubkey), [isPrivateFollowing, pubkey])

  if (!accountPubkey || (pubkey && pubkey === accountPubkey)) return null

  const run = (fn: () => Promise<void>) => {
    checkLogin(async () => {
      setUpdating(true)
      await fn()
      setUpdating(false)
    })
  }

  const handleFollow = (e: React.MouseEvent) => {
    e.stopPropagation()
    run(() => follow(pubkey))
  }

  const handleFollowPrivately = (e: React.MouseEvent) => {
    e.stopPropagation()
    run(() => follow(pubkey, { isPrivate: true }))
  }

  const handleUnfollow = (e: React.MouseEvent) => {
    e.stopPropagation()
    run(() => unfollow(pubkey))
  }

  const handleMoveToPrivate = (e: React.MouseEvent) => {
    e.stopPropagation()
    run(() => moveToPrivate(pubkey))
  }

  const handleMoveToPublic = (e: React.MouseEvent) => {
    e.stopPropagation()
    run(() => moveToPublic(pubkey))
  }

  return isFollowing ? (
    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="min-w-28 rounded-full rounded-r-none border-r-0"
            variant={hover ? 'destructive' : 'secondary'}
            disabled={updating}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            {updating ? (
              <Loader className="animate-spin" />
            ) : hover ? (
              t('Unfollow')
            ) : isPrivate ? (
              <span className="flex items-center gap-1">
                <Lock className="size-3.5" />
                {t('buttonFollowing')}
              </span>
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={hover ? 'destructive' : 'secondary'}
            className="rounded-full rounded-l-none px-2"
            disabled={updating}
            onClick={(e) => e.stopPropagation()}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
          {isPrivate ? (
            <DropdownMenuItem onClick={handleMoveToPublic}>
              <Eye className="mr-2 size-4" />
              {t('Move to public follows')}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleMoveToPrivate}>
              <EyeOff className="mr-2 size-4" />
              {t('Move to private follows')}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  ) : (
    <div onClick={(e) => e.stopPropagation()} className="flex items-center">
      <Button
        className="min-w-28 rounded-full rounded-r-none border-r-0"
        onClick={handleFollow}
        disabled={updating}
      >
        {updating ? <Loader className="animate-spin" /> : t('Follow')}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="rounded-full rounded-l-none px-2"
            disabled={updating}
            onClick={(e) => e.stopPropagation()}
          >
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={handleFollowPrivately}>
            <Lock className="mr-2 size-4" />
            {t('Follow privately')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
