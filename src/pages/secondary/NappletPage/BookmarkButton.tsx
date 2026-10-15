import { Button } from '@/components/ui/button'
import { isNappletBookmarked } from '@/lib/napplet/bookmark'
import { nappletAccountKey, registerNappletSession } from '@/lib/napplet/session'
import { useBookmarks } from '@/providers/BookmarksProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Bookmark, Loader } from 'lucide-react'
import type { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function NappletBookmarkButton({ event }: { event: Event }) {
  const { t } = useTranslation()
  const { account, bookmarkListEvent, checkLogin } = useNostr()
  const { addBookmark, removeBookmark } = useBookmarks()
  const [updating, setUpdating] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const key = nappletAccountKey(account)
  const list = bookmarkListEvent?.pubkey === account?.pubkey ? bookmarkListEvent : null
  const bookmarked = isNappletBookmarked(event, list)

  useEffect(() => {
    setUpdating(false)
    const cancel = () => pending.current?.abort()
    const unregister = registerNappletSession(cancel)
    return () => {
      cancel()
      unregister()
    }
  }, [key])

  return (
    <Button
      type="button"
      variant="ghost"
      size="titlebar-icon"
      title={t(bookmarked ? 'Remove bookmark' : 'Bookmark')}
      aria-label={t(bookmarked ? 'Remove bookmark' : 'Bookmark')}
      aria-pressed={bookmarked}
      disabled={updating}
      onClick={() => {
        void checkLogin(async () => {
          if (pending.current && !pending.current.signal.aborted) return
          const controller = new AbortController()
          pending.current = controller
          setUpdating(true)
          try {
            await (bookmarked ? removeBookmark : addBookmark)(event, controller.signal)
          } catch (error) {
            if (!controller.signal.aborted)
              toast.error(error instanceof Error ? error.message : String(error))
          } finally {
            if (pending.current === controller) {
              pending.current = null
              if (!controller.signal.aborted) setUpdating(false)
            }
          }
        })
      }}
    >
      {updating ? (
        <Loader className="animate-spin" />
      ) : (
        <Bookmark className={bookmarked ? 'fill-primary text-primary' : undefined} />
      )}
    </Button>
  )
}
