import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useFetchProfile } from '@/hooks'
import { sanitizeContactComment, sanitizeContactName } from '@/lib/contact-note'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { Check, Loader, Lock, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const AUTOSAVE_DELAY = 5000

export default function ContactNoteCard({ pubkey }: { pubkey: string }) {
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

  // Flush on unmount (navigating away).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      flushRef.current()
    }
  }, [])

  if (!canEdit) return null

  const currentName = profile?.username ?? ''
  const mismatch = !!name && !!currentName && name !== currentName

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" />
          {t('Private note')}
        </div>
        {saving ? (
          <Loader className="size-3.5 animate-spin text-muted-foreground" />
        ) : dirty ? (
          <span className="size-2 rounded-full bg-amber-500" title={t('Unsaved')} />
        ) : (
          <Check className="size-3.5 text-muted-foreground/50" />
        )}
      </div>
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
      {mismatch && (
        <button
          type="button"
          onClick={() => {
            setNameDraft(currentName)
            setDirty(true)
            schedule()
          }}
          className="flex items-center gap-1.5 text-xs text-amber-500 hover:text-amber-400"
          title={t('Update saved name')}
        >
          <TriangleAlert className="size-3.5 shrink-0" />
          <span className="truncate">{t('Now broadcasting: {{n}}', { n: currentName })}</span>
        </button>
      )}
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
    </div>
  )
}
