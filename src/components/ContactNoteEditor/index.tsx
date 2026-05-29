import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useFetchProfile } from '@/hooks'
import { sanitizeContactComment, sanitizeContactName } from '@/lib/contact-note'
import { cn } from '@/lib/utils'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { Loader, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const AUTOSAVE_DELAY = 5000

// Lightweight, always-editable name + note for a single contact. Persists 5s
// after the last keystroke and on unmount. Works for any pubkey — followed or
// not. Renders nothing for logged-out / npub sessions (can't encrypt).
export default function ContactNoteEditor({
  pubkey,
  className
}: {
  pubkey: string
  className?: string
}) {
  const { t } = useTranslation()
  const { names, comments, canEdit, setName, setComment } = useContactNotes()
  const { profile } = useFetchProfile(pubkey)

  const savedName = names.get(pubkey) ?? ''
  const savedComment = comments.get(pubkey) ?? ''
  const [name, setNameDraft] = useState(savedName)
  const [comment, setCommentDraft] = useState(savedComment)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const nameRef = useRef(name)
  nameRef.current = name
  const commentRef = useRef(comment)
  commentRef.current = comment
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const savedRef = useRef({ savedName, savedComment })
  savedRef.current = { savedName, savedComment }
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pull in background/external changes only while the user isn't mid-edit.
  useEffect(() => {
    if (dirtyRef.current) return
    setNameDraft(savedName)
    setCommentDraft(savedComment)
  }, [savedName, savedComment])

  const flushRef = useRef<() => Promise<void>>(async () => {})
  flushRef.current = async () => {
    if (!dirtyRef.current) return
    const { savedName, savedComment } = savedRef.current
    const nm = nameRef.current
    const cm = commentRef.current
    const nameChanged = sanitizeContactName(nm) !== savedName
    const commentChanged = sanitizeContactComment(cm) !== savedComment
    setDirty(false)
    if (!nameChanged && !commentChanged) return
    setSaving(true)
    try {
      if (nameChanged) await setName(pubkey, nm)
      if (commentChanged) await setComment(pubkey, cm)
    } finally {
      setSaving(false)
    }
  }

  const schedule = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => flushRef.current(), AUTOSAVE_DELAY)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      flushRef.current()
    }
  }, [])

  if (!canEdit) return null

  const currentName = profile?.username ?? ''

  return (
    <div className={cn('space-y-2 rounded-md border border-border/60 bg-muted/30 p-3', className)}>
      <div className="flex h-4 items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Lock className="size-3" />
          {t('Private note')}
        </div>
        {saving && (
          <span className="flex items-center gap-1">
            <Loader className="size-3 animate-spin" />
            {t('Saving edits')}
          </span>
        )}
      </div>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">{t('Saved name')}</span>
        <Input
          value={name}
          onChange={(e) => {
            setNameDraft(e.target.value)
            setDirty(true)
            schedule()
          }}
          placeholder={currentName || t('Saved name (for rename detection)')}
          className="h-8"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">{t('Note')}</span>
        <Textarea
          value={comment}
          onChange={(e) => {
            setCommentDraft(e.target.value)
            setDirty(true)
            schedule()
          }}
          placeholder={t('Private note, e.g. "met at Alice’s party"')}
          rows={2}
        />
      </label>
    </div>
  )
}
