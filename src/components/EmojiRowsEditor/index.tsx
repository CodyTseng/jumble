import Image from '@/components/Image'
import Uploader from '@/components/PostEditor/Uploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ImagePlus, Loader, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type TEmojiRow = { shortcode: string; url: string; uploading?: boolean }

export const emptyEmojiRow = (): TEmojiRow => ({ shortcode: '', url: '' })

export default function EmojiRowsEditor({
  rows,
  onChange
}: {
  rows: TEmojiRow[]
  onChange: (rows: TEmojiRow[]) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()

  const updateRow = (i: number, patch: Partial<TEmojiRow>) =>
    onChange(rows.map((row, idx) => (idx === i ? { ...row, ...patch } : row)))

  const addRow = () => onChange([...rows, emptyEmojiRow()])

  const removeRow = (i: number) =>
    onChange(rows.length === 1 ? [emptyEmojiRow()] : rows.filter((_, idx) => idx !== i))

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={i} className={cn('flex gap-2', isSmallScreen ? 'items-start' : 'items-center')}>
          <Uploader
            className="shrink-0"
            accept="image/*"
            onUploadStart={() => updateRow(i, { uploading: true })}
            onUploadEnd={() => updateRow(i, { uploading: false })}
            onUploadSuccess={({ url }) => updateRow(i, { url, uploading: false })}
          >
            <div
              className="group bg-muted/30 hover:bg-muted relative flex size-10 cursor-pointer items-center justify-center overflow-hidden rounded-md border"
              title={t('Upload')}
            >
              {row.uploading ? (
                <Loader className="text-muted-foreground size-4 animate-spin" />
              ) : row.url ? (
                <>
                  <Image
                    image={{ url: row.url }}
                    className="size-9 object-contain"
                    classNames={{ wrapper: 'size-9 border-none' }}
                    hideIfError
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                    <ImagePlus className="size-4 text-white" />
                  </div>
                </>
              ) : (
                <ImagePlus className="text-muted-foreground size-5" />
              )}
            </div>
          </Uploader>
          <div
            className={cn(
              'flex min-w-0 flex-1 gap-2',
              isSmallScreen ? 'flex-col' : 'flex-row items-center'
            )}
          >
            <Input
              value={row.shortcode}
              placeholder={t('shortcode')}
              className={cn('min-w-0', isSmallScreen ? '' : 'w-40 shrink-0')}
              onChange={(e) => updateRow(i, { shortcode: e.target.value })}
            />
            <Input
              value={row.url}
              placeholder="https://..."
              className="min-w-0 flex-1"
              onChange={(e) => updateRow(i, { url: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground shrink-0"
            onClick={() => removeRow(i)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" className="w-fit" onClick={addRow}>
        <Plus className="me-1 size-4" />
        {t('Add emoji')}
      </Button>
    </div>
  )
}
