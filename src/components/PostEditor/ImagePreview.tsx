import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { ImageAttachment } from '@/services/post-editor-cache.service'
import { Info, Pencil, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ImagePreview({
  images,
  onRemove,
  onUpdateAlt
}: {
  images: ImageAttachment[]
  onRemove: (index: number) => void
  onUpdateAlt: (index: number, alt: string) => void
}) {
  const { t } = useTranslation()
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [altText, setAltText] = useState('')

  const handleOpenAltDialog = (index: number) => {
    setEditingIndex(index)
    setAltText(images[index]?.alt || '')
  }

  const handleSaveAlt = () => {
    if (editingIndex !== null) {
      onUpdateAlt(editingIndex, altText)
      setEditingIndex(null)
      setAltText('')
    }
  }

  if (images.length === 0) return null

  return (
    <>
      <div className="space-y-2">
        <ScrollArea className="w-full">
          <div className="flex gap-2 pb-2">
            {images.map((image, index) => (
              <div
                key={`${image.url}-${index}`}
                className="relative group rounded-lg overflow-hidden border bg-muted/40 shrink-0"
                style={{ width: '120px', height: '120px' }}
              >
                <img
                  src={image.url}
                  alt={image.alt || t('Uploaded image')}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => handleOpenAltDialog(index)}
                    title={t('Add alt text')}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-white hover:bg-white/20"
                    onClick={() => onRemove(index)}
                    title={t('Remove image')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {image.alt && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-1 truncate">
                    {image.alt}
                  </div>
                )}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <Dialog open={editingIndex !== null} onOpenChange={() => setEditingIndex(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Add alt text')}</DialogTitle>
            <DialogDescription className="flex items-start gap-2 pt-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="text-sm">
                {t(
                  'Alt text helps people who use screen readers by describing what is in the image. Good descriptions are concise and provide important context.'
                )}
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {editingIndex !== null && images[editingIndex] && (
              <div className="rounded-lg overflow-hidden border bg-muted/40">
                <img
                  src={images[editingIndex].url}
                  alt={images[editingIndex].alt || t('Preview')}
                  className="w-full h-auto max-h-48 object-contain"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="alt-text">{t('Description')}</Label>
              <Input
                id="alt-text"
                value={altText}
                onChange={(e) => setAltText(e.target.value)}
                placeholder={t('Describe this image...')}
                maxLength={200}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSaveAlt()
                  }
                }}
              />
              <div className="text-xs text-muted-foreground text-right">
                {altText.length}/200
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditingIndex(null)
                setAltText('')
              }}
            >
              {t('Cancel')}
            </Button>
            <Button type="button" onClick={handleSaveAlt}>
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
