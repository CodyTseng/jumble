import UserAvatar from '@/components/UserAvatar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useFetchProfile } from '@/hooks'
import { cn } from '@/lib/utils'
import { Check, Loader, Trash2, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type TRowState = 'dirty' | 'saving' | 'saved'

export default function ContactNoteRow({
  pubkey,
  name,
  comment,
  state,
  onNameChange,
  onCommentChange,
  onAdoptCurrent,
  onDelete
}: {
  pubkey: string
  name: string
  comment: string
  state: TRowState
  onNameChange: (value: string) => void
  onCommentChange: (value: string) => void
  onAdoptCurrent: (currentName: string) => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(pubkey)
  const currentName = profile?.username ?? ''
  const mismatch = !!name && !!currentName && name !== currentName

  return (
    <div className="flex gap-3 px-4 py-3">
      <UserAvatar userId={pubkey} size="small" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={currentName || t('Saved name (for rename detection)')}
            className="h-8 flex-1"
          />
          <StateDot state={state} />
          <button
            type="button"
            onClick={onDelete}
            className="text-muted-foreground hover:text-destructive"
            title={t('Delete')}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        {mismatch && (
          <button
            type="button"
            onClick={() => onAdoptCurrent(currentName)}
            className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400"
            title={t('Update saved name')}
          >
            <TriangleAlert className="size-3.5 shrink-0" />
            <span className="truncate">{t('Now broadcasting: {{n}}', { n: currentName })}</span>
          </button>
        )}
        <Textarea
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder={t('Private note, e.g. "met at Alice’s party"')}
          rows={2}
        />
      </div>
    </div>
  )
}

function StateDot({ state }: { state: TRowState }) {
  const { t } = useTranslation()
  if (state === 'saving') {
    return <Loader className="size-4 shrink-0 animate-spin text-muted-foreground" />
  }
  if (state === 'dirty') {
    return (
      <span
        className="size-2 shrink-0 rounded-full bg-amber-500"
        title={t('Unsaved')}
        aria-label={t('Unsaved')}
      />
    )
  }
  return <Check className={cn('size-4 shrink-0 text-muted-foreground/50')} aria-label={t('Saved')} />
}
