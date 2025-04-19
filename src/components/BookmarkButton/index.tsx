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
  const { pubkey: accountPubkey, bookmarkListEvent, checkLogin } = useNostr()
  const { addBookmark, removeBookmark } = useBookmarks()
  const [updating, setUpdating] = useState(false)
  const isBookmarked = useMemo(
    () => bookmarkListEvent?.tags.some((tag) => tag[0] === 'e' && tag[1] === event.id),
    [bookmarkListEvent, event]
  )

  if (!accountPubkey) return null

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isBookmarked) return

      setUpdating(true)
      try {
        await addBookmark(event)
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
        await removeBookmark(event)
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
        isBookmarked ? 'text-rose-400' : 'text-muted-foreground'
      } enabled:hover:text-rose-400 px-3 h-full`}
      onClick={isBookmarked ? handleRemoveBookmark : handleBookmark}
      disabled={updating}
      title={isBookmarked ? t('Remove bookmark') : t('Bookmark')}
    >
      {updating ? (
        <Loader className="animate-spin" />
      ) : (
        <BookmarkIcon className={isBookmarked ? 'fill-rose-400' : ''} />
      )}
    </button>
  )
}
