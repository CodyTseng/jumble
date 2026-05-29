import UserAvatar from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useFetchProfile } from '@/hooks'
import { TContactNote } from '@/lib/contact-note'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { Check, Loader, Trash2, UserRoundCog } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function ContactNoteRow({ note }: { note: TContactNote }) {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(note.pubkey)
  const { setNote, removeNote } = useContactNotes()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(note.name)
  const [comment, setComment] = useState(note.comment)
  const [busy, setBusy] = useState(false)

  const currentName = profile?.username ?? ''
  const rebrand = !!note.name && !!currentName && note.name !== currentName

  const open = () => {
    setName(note.name)
    setComment(note.comment)
    setEditing(true)
  }

  const save = async () => {
    setBusy(true)
    try {
      await setNote(note.pubkey, { name, comment })
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const adoptCurrent = async () => {
    setBusy(true)
    try {
      await setNote(note.pubkey, { name: currentName })
      toast.success(t('Saved name updated'))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await removeNote(note.pubkey)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-3 px-4 py-3">
      <UserAvatar userId={note.pubkey} size="small" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{note.name || currentName}</span>
          {rebrand && (
            <button
              type="button"
              title={t('Now broadcasting: {{n}}', { n: currentName })}
              onClick={adoptCurrent}
              disabled={busy}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-amber-500 hover:bg-amber-500/10"
              aria-label={t('Update saved name')}
            >
              <UserRoundCog className="size-4" />
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('Saved name (for rename detection)')}
              className="h-8"
            />
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('Private note, e.g. "met at Alice’s party"')}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(false)}>
                {t('Cancel')}
              </Button>
              <Button size="sm" disabled={busy} onClick={save}>
                {busy ? <Loader className="size-4 animate-spin" /> : <Check className="size-4" />}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {note.comment && (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap wrap-break-word">
                {note.comment}
              </div>
            )}
            <div className="flex gap-3 pt-0.5 text-xs text-muted-foreground">
              <button type="button" className="hover:text-foreground" onClick={open} disabled={busy}>
                {t('Edit')}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 hover:text-destructive"
                onClick={remove}
                disabled={busy}
              >
                <Trash2 className="size-3" />
                {t('Delete')}
              </button>
            </div>
          </>
        )}
      </div>
      {busy && !editing && <Loader className="size-4 shrink-0 animate-spin text-muted-foreground" />}
    </div>
  )
}
