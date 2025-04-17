import { useToast } from '@/hooks'
import { useBookmarks } from '@/providers/BookmarksProvider'
import { useNostr } from '@/providers/NostrProvider'
import { BookmarkIcon, Loader } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Event } from 'nostr-tools'

export default function BookmarkButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { bookmarks, addBookmark, removeBookmark } = useBookmarks()
  const [updating, setUpdating] = useState(false)

  const eventId = event.id
  const eventPubkey = event.pubkey

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
        await addBookmark(eventId, eventPubkey)
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
    <button
      className={`flex items-center gap-1 ${
        isBookmarked ? 'text-primary' : 'text-muted-foreground'
      } enabled:hover:text-primary px-3 h-full`}
      onClick={isBookmarked ? handleRemoveBookmark : handleBookmark}
      disabled={updating}
      title={isBookmarked ? t('Remove bookmark') : t('Bookmark')}
    >
      {updating ? (
        <Loader className="animate-spin" />
      ) : (
        <BookmarkIcon className={isBookmarked ? 'fill-primary' : ''} />
      )}
    </button>
  )
}
