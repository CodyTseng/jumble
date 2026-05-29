import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { Loader, Lock, NotebookPen, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ContactNoteCard({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { notes, canEdit, setNote } = useContactNotes()

  const note = notes.get(pubkey)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(note?.name ?? '')
  const [comment, setComment] = useState(note?.comment ?? '')
  const [saving, setSaving] = useState(false)

  if (!canEdit) return null

  const open = () => {
    setName(note?.name ?? '')
    setComment(note?.comment ?? '')
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await setNote(pubkey, { name, comment })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" />
          {t('Private to you, encrypted')}
        </div>
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
          rows={3}
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => setEditing(false)}>
            {t('Cancel')}
          </Button>
          <Button size="sm" disabled={saving} onClick={handleSave}>
            {saving ? <Loader className="animate-spin" /> : t('Save')}
          </Button>
        </div>
      </div>
    )
  }

  if (!note) {
    return (
      <button
        type="button"
        onClick={open}
        className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <NotebookPen className="size-4" />
        {t('Add private note')}
      </button>
    )
  }

  return (
    <div className="mt-2 space-y-1 rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" />
          {t('Private note')}
        </div>
        <button
          type="button"
          onClick={open}
          className="text-muted-foreground hover:text-foreground"
          title={t('Edit')}
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
      {note.name && (
        <div className="text-sm">
          <span className="text-muted-foreground">{t('Saved name')}: </span>
          <span className="font-medium">{note.name}</span>
        </div>
      )}
      {note.comment && (
        <div className="text-sm whitespace-pre-wrap wrap-break-word select-text">
          {note.comment}
        </div>
      )}
    </div>
  )
}
