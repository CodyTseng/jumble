import Note from '@/components/Note'
import { useFetchEvent } from '@/hooks'
import { usePrivateNote } from '@/hooks/usePrivateNote'
import { cn } from '@/lib/utils'
import { toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { PrivateNote as TPrivateNote } from '@/services/private-notes.service'
import { StickyNote, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface PrivateNoteProps {
  pubkey: string
}

export default function PrivateNote({ pubkey }: PrivateNoteProps) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { note, updateNote } = usePrivateNote(pubkey)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { event: pinnedEvent } = useFetchEvent(note?.noteEventId)

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(editText.length, editText.length)
    }
  }, [isEditing])

  const handleClick = () => {
    setEditText(note?.text ?? '')
    setIsEditing(true)
  }

  const handleBlur = () => {
    setIsEditing(false)
    if (editText.trim()) {
      const newNote: TPrivateNote = {
        text: editText.trim(),
        noteEventId: note?.noteEventId
      }
      updateNote(newNote)
    } else if (note) {
      // If text is empty but there's still a pinned note, keep just the note reference
      if (note.noteEventId) {
        const newNote: TPrivateNote = {
          text: '',
          noteEventId: note.noteEventId
        }
        updateNote(newNote)
      } else {
        // Delete the note entirely if no text and no pinned note
        updateNote(null)
      }
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    updateNote(null)
  }

  if (!note && !isEditing) {
    return null
  }

  const displayText = note?.text || ''
  const lines = displayText.split('\n')
  const truncatedText =
    lines.length > 2 ? lines.slice(0, 2).join('\n') + '...' : displayText

  return (
    <div
      className={cn(
        'relative bg-gradient-to-br from-yellow-100 to-yellow-200 dark:from-yellow-200 dark:to-yellow-300',
        'border border-yellow-300 dark:border-yellow-400 rounded-md shadow-md',
        'mt-3 mb-3 transition-all hover:shadow-lg',
        'before:content-[""] before:absolute before:top-0 before:left-0 before:w-full before:h-2',
        'before:bg-gradient-to-b before:from-yellow-300/50 before:to-transparent before:rounded-t-md'
      )}
    >
      <div className="p-3 cursor-pointer hover:scale-[1.01] transition-transform" onClick={handleClick}>
        <div className="flex items-start gap-2">
          <StickyNote className="size-4 text-yellow-700 dark:text-yellow-800 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <textarea
                ref={textareaRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onBlur={handleBlur}
                onClick={(e) => e.stopPropagation()}
                placeholder={t('Add a private note about this user...')}
                className={cn(
                  'w-full bg-transparent text-sm text-yellow-900 dark:text-yellow-950',
                  'placeholder:text-yellow-600 dark:placeholder:text-yellow-700',
                  'border-none outline-none resize-none min-h-[3rem]',
                  'font-handwriting'
                )}
                style={{ fontFamily: "'Kalam', cursive" }}
                rows={3}
              />
            ) : (
              <>
                {displayText && (
                  <div
                    className="text-sm text-yellow-900 dark:text-yellow-950 whitespace-pre-wrap break-words mb-2"
                    style={{ fontFamily: "'Kalam', cursive" }}
                  >
                    {truncatedText}
                  </div>
                )}
                {!displayText && !note?.noteEventId && (
                  <div
                    className="text-sm text-yellow-900 dark:text-yellow-950 whitespace-pre-wrap break-words"
                    style={{ fontFamily: "'Kalam', cursive" }}
                  >
                    {t('Click to add a note...')}
                  </div>
                )}
              </>
            )}
          </div>
          <button
            onClick={handleDelete}
            className="text-yellow-700 dark:text-yellow-800 hover:text-red-600 dark:hover:text-red-700 transition-colors shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
      {note?.noteEventId && pinnedEvent && (
        <div className="border-t border-yellow-600 dark:border-yellow-600 mx-3 pt-2 pb-2">
          <div className="text-xs text-yellow-700 dark:text-yellow-800 mb-2 flex items-center gap-1">
            <StickyNote className="size-3" />
            <span>{t('Pinned note:')}</span>
          </div>
          <div
            className="border border-yellow-600 dark:border-yellow-600 rounded-md p-2 bg-transparent text-gray-800 dark:text-yellow-700 cursor-pointer hover:bg-yellow-50 dark:hover:bg-yellow-200/20 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              push(toNote(pinnedEvent))
            }}
          >
            <Note
              event={pinnedEvent}
              size="small"
              hideParentNotePreview={true}
              compactMedia={true}
              metadataClassName="text-yellow-700 dark:text-yellow-700"
            />
          </div>
        </div>
      )}
    </div>
  )
}
