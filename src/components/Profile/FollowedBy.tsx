import ProfileList from '@/components/ProfileList'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function FollowedBy({ pubkey }: { pubkey: string }) {
  const { pubkey: accountPubkey } = useNostr()

  return (
    <FollowedByContent
      key={`${accountPubkey}:${pubkey}`}
      pubkey={pubkey}
      accountPubkey={accountPubkey}
    />
  )
}

function FollowedByContent({
  pubkey,
  accountPubkey
}: {
  pubkey: string
  accountPubkey: string | null
}) {
  const { t } = useTranslation()
  const { currentIndex } = useSecondaryPage()
  const [open, setOpen] = useState(false)
  const [followedBy, setFollowedBy] = useState<string[]>([])

  useEffect(() => {
    // Profile links can also be opened from the avatars' hover cards.
    // Close on navigation even though PageManager keeps this page mounted.
    setOpen(false)
  }, [currentIndex])

  useEffect(() => {
    if (!pubkey || !accountPubkey) return
    let cancelled = false

    const init = async () => {
      const followings = (await client.fetchFollowings(accountPubkey)).reverse()
      const followingsOfFollowings = await Promise.all(
        followings.map(async (following) => {
          return client.fetchFollowings(following, false)
        })
      )
      const _followedBy: string[] = []
      for (const [index, following] of followings.entries()) {
        if (following === pubkey) continue
        if (followingsOfFollowings[index].includes(pubkey)) {
          _followedBy.push(following)
        }
      }
      if (!cancelled) setFollowedBy(_followedBy)
    }
    init().catch(console.error)
    return () => {
      cancelled = true
    }
  }, [pubkey, accountPubkey])

  if (followedBy.length === 0) return null

  const previewPubkeys = followedBy.slice(0, 5)
  const remainingCount = followedBy.length - previewPubkeys.length

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="group text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex max-w-full cursor-pointer flex-wrap items-center gap-x-2 gap-y-1 rounded-sm text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <span className="wrap-anywhere group-hover:underline group-hover:underline-offset-4">
            {t('Followed by')}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="flex items-center">
              {previewPubkeys.map((p) => (
                <span key={p} className="ring-background -ms-1.5 rounded-full ring-2 first:ms-0">
                  <SimpleUserAvatar userId={p} size="xSmall" />
                </span>
              ))}
            </span>
            {remainingCount > 0 && (
              <span className="text-xs tabular-nums" dir="ltr">
                +{remainingCount}
              </span>
            )}
          </span>
        </button>
      </DialogTrigger>
      <DialogContent
        className="w-140 max-w-[calc(100vw-2rem)]"
        bodyClassName="min-w-0 grid-cols-1 overflow-x-hidden overflow-y-auto px-4"
      >
        <DialogTitle className="pe-8">
          {t('Followed by')} ({followedBy.length})
        </DialogTitle>
        <ProfileList pubkeys={followedBy} className="px-0" />
      </DialogContent>
    </Dialog>
  )
}
