import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks'
import { useBookmarks } from '@/providers/BookmarksProvider'
import { useNostr } from '@/providers/NostrProvider'
import { BookmarkIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function BookmarkButton({
  eventId,
  eventPubkey,
  relayHint
}: {
  eventId: string
  eventPubkey: string
  relayHint?: string
}) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { bookmarks, addBookmark, removeBookmark } = useBookmarks()
  const [updating, setUpdating] = useState(false)

  const isBookmarked = useMemo(
    () => bookmarks.some((tag) => tag[0] === 'e' && tag[1] === eventId),
    [bookmarks, eventId]
  )

  if (!accountPubkey) return null

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isBookmarked) return

      setUpdating(true)
      try {
        await addBookmark(eventId, eventPubkey, relayHint)
        toast({
          title: t('Note bookmarked'),
          description: t('This note has been added to your bookmarks')
        })
      } catch (error) {
        toast({
          title: t('Bookmark failed'),
          description: (error as Error).message,
          variant: 'destructive'
        })
      } finally {
        setUpdating(false)
      }
    })
  }

  const handleRemoveBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!isBookmarked) return

      setUpdating(true)
      try {
        await removeBookmark(eventId)
        toast({
          title: t('Bookmark removed'),
          description: t('This note has been removed from your bookmarks')
        })
      } catch (error) {
        toast({
          title: t('Remove bookmark failed'),
          description: (error as Error).message,
          variant: 'destructive'
        })
      } finally {
        setUpdating(false)
      }
    })
  }

  return (
    <Button
      size="icon"
      variant="ghost"
      disabled={updating}
      className={`size-8 ${isBookmarked ? 'text-primary' : ''}`}
      onClick={isBookmarked ? handleRemoveBookmark : handleBookmark}
      aria-label={isBookmarked ? t('Remove bookmark') : t('Bookmark')}
    >
      <BookmarkIcon className="size-4" />
    </Button>
  )
}
