import UserAvatar from '@/components/UserAvatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useFetchProfile } from '@/hooks'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { Check, Loader, TriangleAlert, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function ContactNoteRow({ pubkey }: { pubkey: string }) {
  const { t } = useTranslation()
  const { profile } = useFetchProfile(pubkey)
  const { names, comments, setName, setComment } = useContactNotes()

  const savedName = names.get(pubkey) ?? ''
  const savedComment = comments.get(pubkey) ?? ''
  const [editing, setEditing] = useState(false)
  const [nameDraft, setNameDraft] = useState(savedName)
  const [commentDraft, setCommentDraft] = useState(savedComment)
  const [busy, setBusy] = useState(false)

  const currentName = profile?.username ?? ''
  const mismatch = !!savedName && !!currentName && savedName !== currentName

  const open = () => {
    setNameDraft(savedName)
    setCommentDraft(savedComment)
    setEditing(true)
  }

  const save = async () => {
    setBusy(true)
    try {
      if (nameDraft !== savedName) await setName(pubkey, nameDraft)
      if (commentDraft !== savedComment) await setComment(pubkey, commentDraft)
      setEditing(false)
    } finally {
      setBusy(false)
    }
  }

  const adoptCurrent = async () => {
    setBusy(true)
    try {
      await setName(pubkey, currentName)
      toast.success(t('Saved name updated'))
    } finally {
      setBusy(false)
    }
  }

  const removeAll = async () => {
    setBusy(true)
    try {
      if (savedName) await setName(pubkey, '')
      if (savedComment) await setComment(pubkey, '')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex gap-3 px-4 py-3">
      <UserAvatar userId={pubkey} size="small" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{savedName || currentName}</span>
          {mismatch && (
            <button
              type="button"
              title={t('Now broadcasting: {{n}}', { n: currentName })}
              onClick={adoptCurrent}
              disabled={busy}
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-amber-500 hover:bg-amber-500/10"
              aria-label={t('Update saved name')}
            >
              <TriangleAlert className="size-4" />
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-2">
            <Input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder={t('Saved name (for rename detection)')}
              className="h-8"
            />
            <Textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
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
            {savedComment && (
              <div className="text-sm text-muted-foreground whitespace-pre-wrap wrap-break-word">
                {savedComment}
              </div>
            )}
            <div className="flex gap-3 pt-0.5 text-xs text-muted-foreground">
              <button type="button" className="hover:text-foreground" onClick={open} disabled={busy}>
                {t('Edit')}
              </button>
              <button
                type="button"
                className="flex items-center gap-1 hover:text-destructive"
                onClick={removeAll}
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
