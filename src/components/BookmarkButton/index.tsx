import { useStuff } from '@/hooks/useStuff'
import { getReplaceableCoordinateFromEvent, isReplaceableEvent } from '@/lib/event'
import { useBookmarks } from '@/providers/BookmarksProvider'
import { useNostr } from '@/providers/NostrProvider'
import { BookmarkIcon, Loader } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function BookmarkButton({ stuff }: { stuff: Event | string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, bookmarkListEvent, checkLogin } = useNostr()
  const { addBookmark, removeBookmark } = useBookmarks()
  const [updating, setUpdating] = useState(false)
  const { event } = useStuff(stuff)
  const isBookmarked = useMemo(() => {
    if (!event) return false

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
      if (isBookmarked || !event) return

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
      if (!isBookmarked || !event) return

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
        isBookmarked ? 'text-rose-400' : 'text-muted-foreground'
      } enabled:hover:text-rose-400 px-3 h-full disabled:text-muted-foreground/40 disabled:cursor-default`}
      onClick={isBookmarked ? handleRemoveBookmark : handleBookmark}
      disabled={!event || updating}
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
