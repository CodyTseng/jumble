import { Button } from '@/components/ui/button'
import { SettingsGroup, SettingsPageContainer, SettingsRow } from '@/components/ui/settings'
import { Switch } from '@/components/ui/switch'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { sanitizeContactComment, sanitizeContactName } from '@/lib/contact-note'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import client from '@/services/client.service'
import { Check, Loader, Lock } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ContactNoteRow, { TRowState } from './ContactNoteRow'

const AUTOSAVE_DELAY = 5000

type TDraft = { name: string; comment: string }

const ContactNotesSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { names, comments, canEdit, loading, setNamesBatch, setCommentsBatch, bulkSnapshotNames } =
    useContactNotes()
  const {
    preferSavedContactNames,
    updatePreferSavedContactNames,
    autoSnapshotContactNames,
    updateAutoSnapshotContactNames
  } = useUserPreferences()
  const { followingSet } = useFollowList()
  const [snapshotting, setSnapshotting] = useState(false)

  const followings = useMemo(() => Array.from(followingSet), [followingSet])
  const missingCount = useMemo(
    () => followings.filter((pk) => !names.get(pk)).length,
    [followings, names]
  )

  // --- inline editing with debounced autosave ---------------------------------
  const [drafts, setDrafts] = useState<Map<string, TDraft>>(new Map())
  const [dirty, setDirty] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const draftsRef = useRef(drafts)
  draftsRef.current = drafts
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Reconcile provider state into drafts: refresh non-dirty rows, add new
  // pubkeys, drop rows the provider no longer has (and aren't mid-edit).
  useEffect(() => {
    setDrafts((prev) => {
      const next = new Map(prev)
      const all = new Set<string>([...names.keys(), ...comments.keys()])
      for (const pk of all) {
        if (dirtyRef.current.has(pk)) continue
        next.set(pk, { name: names.get(pk) ?? '', comment: comments.get(pk) ?? '' })
      }
      for (const pk of Array.from(next.keys())) {
        if (!all.has(pk) && !dirtyRef.current.has(pk)) next.delete(pk)
      }
      return next
    })
  }, [names, comments])

  // flushRef always points at the latest closure so the debounce timer and the
  // unmount cleanup save the freshest state.
  const flushRef = useRef<() => Promise<void>>(async () => {})
  flushRef.current = async () => {
    const dirtyPks = Array.from(dirtyRef.current)
    if (dirtyPks.length === 0) return

    const nameChanges: [string, string][] = []
    const commentChanges: [string, string][] = []
    for (const pk of dirtyPks) {
      const d = draftsRef.current.get(pk) ?? { name: '', comment: '' }
      if (sanitizeContactName(d.name) !== (names.get(pk) ?? '')) nameChanges.push([pk, d.name])
      if (sanitizeContactComment(d.comment) !== (comments.get(pk) ?? ''))
        commentChanges.push([pk, d.comment])
    }

    setDirty(new Set())
    if (!nameChanges.length && !commentChanges.length) return
    setSaving(new Set(dirtyPks))
    try {
      if (nameChanges.length) await setNamesBatch(nameChanges)
      if (commentChanges.length) await setCommentsBatch(commentChanges)
    } finally {
      setSaving(new Set())
    }
  }

  const scheduleFlush = () => {
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

  const editDraft = (pk: string, patch: Partial<TDraft>) => {
    setDrafts((prev) => {
      const next = new Map(prev)
      next.set(pk, { name: '', comment: '', ...prev.get(pk), ...patch })
      return next
    })
    setDirty((prev) => new Set(prev).add(pk))
    scheduleFlush()
  }

  const handleSnapshot = async () => {
    setSnapshotting(true)
    try {
      const added = await bulkSnapshotNames(followings, async (pubkey) => {
        const profile = await client.fetchProfile(pubkey)
        return profile?.original_username
      })
      toast[added > 0 ? 'success' : 'info'](
        added > 0 ? t('Saved n names', { n: added }) : t('Nothing new to snapshot')
      )
    } catch (err) {
      toast.error(`${err}`)
    } finally {
      setSnapshotting(false)
    }
  }

  const pubkeys = useMemo(() => Array.from(drafts.keys()), [drafts])
  const rowState = (pk: string): TRowState =>
    saving.has(pk) ? 'saving' : dirty.has(pk) ? 'dirty' : 'saved'
  const globalState: 'saving' | 'dirty' | 'saved' =
    saving.size > 0 ? 'saving' : dirty.size > 0 ? 'dirty' : 'saved'

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Private contact notes')}>
      <SettingsPageContainer>
        <SettingsGroup>
          <div className="flex items-start gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <span>
              {t(
                'Saved names and notes live in NIP-51 lists encrypted to you. Only you can read them.'
              )}
            </span>
          </div>
        </SettingsGroup>

        {!canEdit ? (
          <SettingsGroup>
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t('Log in with a key that can encrypt (not a public-key-only login) to use this.')}
            </div>
          </SettingsGroup>
        ) : (
          <>
            <SettingsGroup>
              <SettingsRow
                htmlFor="auto-snapshot-names"
                title={t('Auto-record follow names')}
                description={t(
                  'Save each follow’s current name in the background, so you’re warned if someone later changes their name to impersonate another contact.'
                )}
                control={
                  <Switch
                    id="auto-snapshot-names"
                    checked={autoSnapshotContactNames}
                    onCheckedChange={updateAutoSnapshotContactNames}
                  />
                }
              />
              {missingCount > 0 && (
                <SettingsRow
                  title={t('Record names now')}
                  description={t('n follows not yet recorded', { n: missingCount })}
                  control={
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSnapshot}
                      disabled={snapshotting}
                    >
                      {snapshotting ? (
                        <Loader className="animate-spin" />
                      ) : (
                        t('Record n', { n: missingCount })
                      )}
                    </Button>
                  }
                />
              )}
              <SettingsRow
                htmlFor="prefer-saved-names"
                title={t('Show saved names')}
                description={t(
                  'Display the name you saved instead of the current one. Off by default — a warning mark shows when they differ.'
                )}
                control={
                  <Switch
                    id="prefer-saved-names"
                    checked={preferSavedContactNames}
                    onCheckedChange={updatePreferSavedContactNames}
                  />
                }
              />
            </SettingsGroup>

            <SettingsGroup
              title={
                <div className="flex items-center justify-between gap-2">
                  <span>{t('n notes', { n: pubkeys.length })}</span>
                  <SaveStatus state={globalState} />
                </div>
              }
            >
              {loading && pubkeys.length === 0 ? (
                <div className="flex justify-center p-6">
                  <Loader className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : pubkeys.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {t('No notes yet. Add one from any profile, or snapshot your follows above.')}
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {pubkeys.map((pk) => {
                    const d = drafts.get(pk) ?? { name: '', comment: '' }
                    return (
                      <ContactNoteRow
                        key={pk}
                        pubkey={pk}
                        name={d.name}
                        comment={d.comment}
                        state={rowState(pk)}
                        onNameChange={(v) => editDraft(pk, { name: v })}
                        onCommentChange={(v) => editDraft(pk, { comment: v })}
                        onAdoptCurrent={(currentName) => editDraft(pk, { name: currentName })}
                        onDelete={() => editDraft(pk, { name: '', comment: '' })}
                      />
                    )
                  })}
                </div>
              )}
            </SettingsGroup>
          </>
        )}
      </SettingsPageContainer>
    </SecondaryPageLayout>
  )
})
ContactNotesSettingsPage.displayName = 'ContactNotesSettingsPage'

function SaveStatus({ state }: { state: 'saving' | 'dirty' | 'saved' }) {
  const { t } = useTranslation()
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1 text-xs normal-case text-muted-foreground">
        <Loader className="size-3 animate-spin" />
        {t('Saving…')}
      </span>
    )
  }
  if (state === 'dirty') {
    return (
      <span className="flex items-center gap-1 text-xs normal-case text-amber-500">
        <span className="size-2 rounded-full bg-amber-500" />
        {t('Unsaved')}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-xs normal-case text-muted-foreground">
      <Check className="size-3" />
      {t('All changes saved')}
    </span>
  )
}

export default ContactNotesSettingsPage
