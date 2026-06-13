import { Button } from '@/components/ui/button'
import { getReplaceableCoordinateFromEvent } from '@/lib/event'
import { getEmojiPackInfoFromEvent } from '@/lib/event-metadata'
import { toEmojiSetEditor } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useEmojiPack } from '@/providers/EmojiPackProvider'
import { useNostr } from '@/providers/NostrProvider'
import { CheckIcon, Loader, Pencil, PlusIcon } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Image from '../Image'

export default function EmojiPack({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey: accountPubkey, checkLogin } = useNostr()
  const { emojiPackCoordinateSet, addEmojiPack, removeEmojiPack } = useEmojiPack()
  const [updating, setUpdating] = useState(false)
  const { title, emojis } = useMemo(() => getEmojiPackInfoFromEvent(event), [event])
  const coordinate = useMemo(() => getReplaceableCoordinateFromEvent(event), [event])
  const isOwner = !!accountPubkey && event.pubkey === accountPubkey
  const isCollected = useMemo(() => {
    return emojiPackCoordinateSet.has(coordinate)
  }, [emojiPackCoordinateSet, coordinate])

  const handleCollect = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (isCollected) return

      setUpdating(true)
      await addEmojiPack(event)
      setUpdating(false)
    })
  }

  const handleRemoveCollect = async (e: React.MouseEvent) => {
    e.stopPropagation()
    checkLogin(async () => {
      if (!isCollected) return

      setUpdating(true)
      await removeEmojiPack(event)
      setUpdating(false)
    })
  }

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-2xl font-semibold">{title}</h3>
        <div className="flex shrink-0 items-center gap-2">
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                push(toEmojiSetEditor(event))
              }}
            >
              <Pencil className="me-1" />
              {t('Edit')}
            </Button>
          )}
          {accountPubkey && (
            <Button
              variant={isCollected ? 'secondary' : 'outline'}
              size="sm"
              onClick={isCollected ? handleRemoveCollect : handleCollect}
              disabled={updating}
            >
              {updating ? (
                <Loader className="me-1 animate-spin" />
              ) : isCollected ? (
                <CheckIcon />
              ) : (
                <PlusIcon />
              )}
              {updating
                ? isCollected
                  ? t('Removing...')
                  : t('Adding...')
                : isCollected
                  ? t('Added')
                  : t('Add')}
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {emojis.map((emoji, index) => (
          <Image
            key={`emoji-${index}`}
            image={{ url: emoji.url, pubkey: event.pubkey }}
            className="size-14 object-contain"
            classNames={{
              wrapper: 'size-14 flex items-center justify-center p-1',
              errorPlaceholder: 'size-14'
            }}
            hideIfError
          />
        ))}
      </div>
    </div>
  )
}
