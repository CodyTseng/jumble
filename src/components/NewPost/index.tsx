import PostEditor from '@/components/PostEditor'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Drawer, DrawerContent } from '@/components/ui/drawer'
import { useSecondaryPage } from '@/PageManager'
import { toNewArticle } from '@/lib/link'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { ChevronRight, FilePenLine, PencilLine } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function NewPost({
  open,
  setOpen
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { isSmallScreen } = useScreenSize()
  const [noteOpen, setNoteOpen] = useState(false)
  const choosingRef = useRef(false)

  const choose = (type: 'note' | 'article') => {
    choosingRef.current = true
    setOpen(false)
    if (type === 'note') setNoteOpen(true)
    else push(toNewArticle())
  }

  const options = (
    <div className="space-y-1 px-3 pb-3">
      {(
        [
          {
            type: 'note',
            label: 'Short note',
            description: 'Share a thought or a moment',
            Icon: PencilLine
          },
          {
            type: 'article',
            label: 'Long-form article',
            description: 'Give your ideas more room',
            Icon: FilePenLine
          }
        ] as const
      ).map(({ type, label, description, Icon }) => (
        <Button
          key={type}
          variant="ghost"
          className="group hover:bg-muted/60 focus-visible:bg-muted/60 h-auto w-full justify-start gap-3.5 rounded-xl px-3 py-3.5 text-start"
          onClick={() => choose(type)}
        >
          <span className="bg-primary/10 text-primary flex size-11 shrink-0 items-center justify-center rounded-xl">
            <Icon className="size-5!" strokeWidth={1.75} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-foreground text-sm font-semibold">{t(label)}</span>
            <span className="text-muted-foreground text-xs leading-relaxed font-normal whitespace-normal">
              {t(description)}
            </span>
          </span>
          <ChevronRight className="text-muted-foreground size-4! shrink-0 opacity-50 transition-opacity group-hover:opacity-100 rtl:-scale-x-100" />
        </Button>
      ))}
    </div>
  )

  const onCloseAutoFocus = (event: Event) => {
    if (choosingRef.current) event.preventDefault()
    choosingRef.current = false
  }

  return (
    <>
      {isSmallScreen ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent title={t('New Note')} onCloseAutoFocus={onCloseAutoFocus}>
            {options}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="max-w-sm gap-0 p-0 sm:rounded-2xl"
            aria-describedby={undefined}
            onCloseAutoFocus={onCloseAutoFocus}
          >
            <DialogHeader className="px-6 pt-6 pb-3">
              <DialogTitle className="text-base">{t('New Note')}</DialogTitle>
            </DialogHeader>
            {options}
          </DialogContent>
        </Dialog>
      )}
      <PostEditor open={noteOpen} setOpen={setNoteOpen} />
    </>
  )
}
