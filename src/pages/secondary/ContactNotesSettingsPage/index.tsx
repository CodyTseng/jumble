import { Button } from '@/components/ui/button'
import { SettingsGroup, SettingsPageContainer, SettingsRow } from '@/components/ui/settings'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useContactNotes } from '@/providers/ContactNotesProvider'
import { useFollowList } from '@/providers/FollowListProvider'
import client from '@/services/client.service'
import { Loader, Lock } from 'lucide-react'
import { forwardRef, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import ContactNoteRow from './ContactNoteRow'

const ContactNotesSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { notes, canEdit, loading, bulkSnapshotNames } = useContactNotes()
  const { followingSet } = useFollowList()
  const [snapshotting, setSnapshotting] = useState(false)

  const followings = useMemo(() => Array.from(followingSet), [followingSet])
  const missingCount = useMemo(
    () => followings.filter((pk) => !notes.get(pk)?.name).length,
    [followings, notes]
  )
  const noteList = useMemo(() => Array.from(notes.values()), [notes])

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

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Private contact notes')}>
      <SettingsPageContainer>
        <SettingsGroup>
          <div className="flex items-start gap-2 px-4 py-3 text-sm text-muted-foreground">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <span>
              {t(
                'Saved names and notes are stored in a NIP-51 list encrypted to you. Only you can read them.'
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
                title={t('Snapshot follow names')}
                description={t(
                  'Save the current display name of everyone you follow, so you’re alerted if they later change it.'
                )}
                control={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSnapshot}
                    disabled={snapshotting || missingCount === 0}
                  >
                    {snapshotting ? (
                      <Loader className="animate-spin" />
                    ) : (
                      t('Snapshot n', { n: missingCount })
                    )}
                  </Button>
                }
              />
            </SettingsGroup>

            <SettingsGroup title={t('n notes', { n: noteList.length })}>
              {loading && noteList.length === 0 ? (
                <div className="flex justify-center p-6">
                  <Loader className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : noteList.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  {t('No notes yet. Add one from any profile, or snapshot your follows above.')}
                </div>
              ) : (
                <div className="divide-y divide-border/60">
                  {noteList.map((note) => (
                    <ContactNoteRow key={note.pubkey} note={note} />
                  ))}
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
export default ContactNotesSettingsPage
