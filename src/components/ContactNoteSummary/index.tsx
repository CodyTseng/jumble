import { cn } from '@/lib/utils'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { Lock, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

// Read-only view of the private name snapshot + comment for a contact. Renders
// nothing unless there's something worth showing (a name mismatch worth warning
// about, or a comment). Used in the hover card and anywhere a compact, private
// annotation readout is useful.
export default function ContactNoteSummary({
  pubkey,
  currentName,
  className
}: {
  pubkey: string
  currentName?: string
  className?: string
}) {
  const { t } = useTranslation()
  const { names, comments, canEdit } = useContactNotes()
  if (!canEdit) return null

  const savedName = names.get(pubkey)
  const comment = comments.get(pubkey)
  const mismatch = !!savedName && !!currentName && savedName !== currentName

  if (!mismatch && !comment) return null

  return (
    <div
      className={cn(
        'space-y-1 rounded-md border border-border/60 bg-muted/40 p-2 text-sm',
        className
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3" />
        {t('Private note')}
      </div>
      {mismatch && (
        <div className="flex items-center gap-1.5 text-xs text-amber-500">
          <TriangleAlert className="size-3.5 shrink-0" />
          <span className="truncate">{t('You saved: {{n}}', { n: savedName })}</span>
        </div>
      )}
      {comment && (
        <div className="line-clamp-4 wrap-break-word whitespace-pre-wrap text-muted-foreground">
          {comment}
        </div>
      )}
    </div>
  )
}
