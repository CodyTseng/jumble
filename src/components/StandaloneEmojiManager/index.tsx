import Image from '@/components/Image'
import { Button } from '@/components/ui/button'
import { useEmojiCollections } from '@/components/ExpressionPicker/useEmojiCollections'
import { toStandaloneEmojiEditor } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { Pencil, PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function StandaloneEmojiManager({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { pubkey, checkLogin } = useNostr()
  const { standalone } = useEmojiCollections()

  const openEditor = () => checkLogin(() => push(toStandaloneEmojiEditor()))

  return (
    <div className={className}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-2xl font-semibold">{t('My emojis')}</h3>
        {pubkey && (
          <Button variant="outline" size="sm" onClick={openEditor} className="shrink-0">
            {standalone.length === 0 ? (
              <>
                <PlusIcon className="me-1" />
                {t('Add emoji')}
              </>
            ) : (
              <>
                <Pencil className="me-1" />
                {t('Edit')}
              </>
            )}
          </Button>
        )}
      </div>

      {standalone.length === 0 ? (
        <div className="text-muted-foreground py-4 text-center text-sm">
          {t('No custom emojis yet')}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {standalone.map((emoji) => (
            <Image
              key={`${emoji.shortcode}:${emoji.url}`}
              image={{ url: emoji.url }}
              className="size-14 object-contain"
              classNames={{
                wrapper: 'size-14 flex items-center justify-center p-1',
                errorPlaceholder: 'size-14'
              }}
              hideIfError
            />
          ))}
        </div>
      )}
    </div>
  )
}
