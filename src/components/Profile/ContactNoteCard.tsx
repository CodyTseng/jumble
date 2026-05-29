import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { Loader, Lock, NotebookPen, Pencil } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function ContactNoteCard({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { names, comments, canEdit, setName, setComment } = useContactNotes()

  const savedName = names.get(pubkey) ?? ''
  const savedComment = comments.get(pubkey) ?? ''
  const [editing, setEditing] = useState(false)
  const [name, setNameDraft] = useState(savedName)
  const [comment, setCommentDraft] = useState(savedComment)
  const [saving, setSaving] = useState(false)

  if (!canEdit) return null

  const open = () => {
    setNameDraft(savedName)
    setCommentDraft(savedComment)
    setEditing(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Two separate encrypted lists — only publish the one(s) that changed.
      if (name !== savedName) await setName(pubkey, name)
      if (comment !== savedComment) await setComment(pubkey, comment)
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
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder={t('Saved name (for rename detection)')}
          className="h-8"
        />
        <Textarea
          value={comment}
          onChange={(e) => setCommentDraft(e.target.value)}
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

  if (!savedName && !savedComment) {
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
      {savedName && (
        <div className="text-sm">
          <span className="text-muted-foreground">{t('Saved name')}: </span>
          <span className="font-medium">{savedName}</span>
        </div>
      )}
      {savedComment && (
        <div className="text-sm whitespace-pre-wrap wrap-break-word select-text">{savedComment}</div>
      )}
    </div>
  )
}
