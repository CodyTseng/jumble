import Image from '@/components/Image'
import ResponsiveDialog from '@/components/ResponsiveDialog'
import { Button } from '@/components/ui/button'
import { useEmojiCollections } from '@/components/ExpressionPicker/useEmojiCollections'
import { getReplaceableCoordinateFromEvent } from '@/lib/event'
import { getEmojiPackInfoFromEvent } from '@/lib/event-metadata'
import { cn } from '@/lib/utils'
import { useEmojiPack } from '@/providers/EmojiPackProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import { TEmoji } from '@/types'
import { useAtom } from 'jotai'
import { CheckIcon, Loader, PlusIcon } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { emojiDetailAtom } from './atom'

export default function EmojiDetailDialog() {
  const [emoji, setEmoji] = useAtom(emojiDetailAtom)

  return (
    <ResponsiveDialog open={!!emoji} onOpenChange={(open) => !open && setEmoji(null)}>
      {emoji && <EmojiDetailContent emoji={emoji} />}
    </ResponsiveDialog>
  )
}

function EmojiDetailContent({ emoji }: { emoji: TEmoji }) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { standalone } = useEmojiCollections()
  const { addStandaloneEmoji, removeStandaloneEmoji } = useEmojiPack()
  const [updating, setUpdating] = useState(false)

  const isCollected = useMemo(
    () => standalone.some((e) => e.shortcode === emoji.shortcode && e.url === emoji.url),
    [standalone, emoji]
  )

  const handleToggle = () => {
    checkLogin(async () => {
      setUpdating(true)
      if (isCollected) {
        await removeStandaloneEmoji({ shortcode: emoji.shortcode, url: emoji.url })
      } else {
        await addStandaloneEmoji({ shortcode: emoji.shortcode, url: emoji.url })
      }
      setUpdating(false)
    })
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          'flex gap-4',
          isSmallScreen ? 'flex-col items-center' : 'flex-row items-center'
        )}
      >
        <Image
          image={{ url: emoji.url }}
          alt={emoji.shortcode}
          className="size-24 object-contain"
          classNames={{
            wrapper: 'flex size-24 shrink-0 items-center justify-center rounded-none',
            errorPlaceholder: 'size-24'
          }}
        />
        <div
          className={cn(
            'flex min-w-0 flex-col gap-3',
            isSmallScreen ? 'items-center' : 'items-start'
          )}
        >
          <div className="text-lg font-semibold break-all" dir="auto">
            {emoji.shortcode}
          </div>
          {accountPubkey && (
            <Button
              variant={isCollected ? 'secondary' : 'default'}
              onClick={handleToggle}
              disabled={updating}
            >
              {updating ? (
                <Loader className="me-1 animate-spin" />
              ) : isCollected ? (
                <CheckIcon className="me-1" />
              ) : (
                <PlusIcon className="me-1" />
              )}
              {isCollected ? t('Added to my emojis') : t('Add this emoji')}
            </Button>
          )}
        </div>
      </div>
      {emoji.setAddress && <EmojiSetSection setAddress={emoji.setAddress} />}
    </div>
  )
}

function EmojiSetSection({ setAddress }: { setAddress: string }) {
  const { t } = useTranslation()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { emojiPackCoordinateSet, addEmojiPack, removeEmojiPack } = useEmojiPack()
  const [setEvent, setSetEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSetEvent(null)
    client
      .fetchEmojiSetEvents([setAddress])
      .then((events) => {
        const event = events.find((e): e is Event => !!e && !(e instanceof Error))
        if (!cancelled) {
          setSetEvent(event ?? null)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [setAddress])

  const { title, emojis } = useMemo(
    () => (setEvent ? getEmojiPackInfoFromEvent(setEvent) : { title: undefined, emojis: [] }),
    [setEvent]
  )
  const coordinate = useMemo(
    () => (setEvent ? getReplaceableCoordinateFromEvent(setEvent) : ''),
    [setEvent]
  )
  const isCollected = useMemo(
    () => emojiPackCoordinateSet.has(coordinate),
    [emojiPackCoordinateSet, coordinate]
  )

  const handleToggle = () => {
    if (!setEvent) return
    checkLogin(async () => {
      setUpdating(true)
      if (isCollected) {
        await removeEmojiPack(setEvent)
      } else {
        await addEmojiPack(setEvent)
      }
      setUpdating(false)
    })
  }

  if (loading) {
    return (
      <div className="flex justify-center border-t pt-4">
        <Loader className="text-muted-foreground animate-spin" />
      </div>
    )
  }

  if (!setEvent) return null

  return (
    <div className="space-y-2 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-base font-semibold" dir="auto">
          {title || t('Emoji set')}
        </h3>
        {accountPubkey && (
          <Button
            variant={isCollected ? 'secondary' : 'outline'}
            size="sm"
            onClick={handleToggle}
            disabled={updating}
            className="shrink-0"
          >
            {updating ? (
              <Loader className="me-1 animate-spin" />
            ) : isCollected ? (
              <CheckIcon className="me-1" />
            ) : (
              <PlusIcon className="me-1" />
            )}
            {isCollected ? t('Added') : t('Add whole set')}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {emojis.map((emoji, index) => (
          <Image
            key={`${emoji.shortcode}-${index}`}
            image={{ url: emoji.url, pubkey: setEvent.pubkey }}
            alt={emoji.shortcode}
            title={`:${emoji.shortcode}:`}
            className="size-12 object-contain"
            classNames={{
              wrapper: 'size-12 flex items-center justify-center p-1',
              errorPlaceholder: 'size-12'
            }}
            hideIfError
          />
        ))}
      </div>
    </div>
  )
}
