import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import { useBookmarks } from '@/providers/BookmarksProvider'
import { useNostr } from '@/providers/NostrProvider'
import { BookmarkIcon, Loader } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function BookmarkButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, bookmarkListEvent, checkLogin } = useNostr()
  const { addBookmark, removeBookmark } = useBookmarks()
  const [updating, setUpdating] = useState(false)
  const isBookmarked = useMemo(() => {
    const isReplaceable = isReplaceableEvent(event.kind)
    const eventKey = isReplaceable ? getReplaceableCoordinateFromEvent(event) : event.id

    return bookmarkListEvent?.tags.some((tag) =>
      isReplaceable ? tag[0] === 'a' && tag[1] === eventKey : tag[0] === 'e' && tag[1] === eventKey
    )
  }, [bookmarkListEvent, event])

  if (!accountPubkey) return null

  const handleBookmark = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isBookmarked) return

      setUpdating(true)
      try {
        await addBookmark(event)
      } catch (error) {
        toast.error(t('Bookmark failed') + ': ' + (error as Error).message)
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
        toast.error(t('Remove bookmark failed') + ': ' + (error as Error).message)
      } finally {
        setUpdating(false)
      }
    })
  }

  return (
    <button
      className={`flex items-center gap-1 ${
        isBookmarked ? 'text-primary opacity-100 pointer-events-auto' : 'text-muted-foreground opacity-0 pointer-events-none'
      } enabled:hover:text-primary px-3 h-full group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity`}
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
