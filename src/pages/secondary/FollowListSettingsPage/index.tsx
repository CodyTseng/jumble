import { Button } from '@/components/ui/button'
import { IS_COMMUNITY_MODE } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { TFollowSet } from '@/lib/follow-set'
import { useFollowSets } from '@/providers/FollowSetsProvider'
import { useNostr } from '@/providers/NostrProvider'
import dialogService from '@/services/dialog.service'
import { List, Plus } from 'lucide-react'
import { forwardRef, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import NotFoundPage from '../NotFoundPage'
import FollowListEditor from './FollowListEditor'

const FollowListSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pubkey } = useNostr()

  if (IS_COMMUNITY_MODE || !pubkey) return <NotFoundPage />

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Follow lists')}>
      <FollowListSettings key={pubkey} />
    </SecondaryPageLayout>
  )
})
FollowListSettingsPage.displayName = 'FollowListSettingsPage'
export default FollowListSettingsPage

function FollowListSettings() {
  const { t } = useTranslation()
  const { followSets, isLoading, canEdit, saveFollowSet, deleteFollowSet } = useFollowSets()
  const [editor, setEditor] = useState<TFollowSet | 'new' | null>(null)
  const [deleting, setDeleting] = useState(false)
  const deletingRef = useRef(false)

  const handleDelete = async (id: string) => {
    if (deletingRef.current) return
    deletingRef.current = true
    setDeleting(true)
    try {
      if (await dialogService.confirm(t('Delete this follow list?'))) await deleteFollowSet(id)
    } catch (error) {
      console.warn('Could not delete follow list', error)
      toast.error(t('Failed'))
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  if (editor) {
    return (
      <FollowListEditor
        set={editor === 'new' ? undefined : editor}
        onCancel={() => setEditor(null)}
        onSave={async (name, pubkeys) => {
          const result = await saveFollowSet(name, pubkeys, editor === 'new' ? undefined : editor)
          if (result === 'saved') setEditor(null)
          return result
        }}
      />
    )
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {followSets.map((set) => (
        <div key={set.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <List className="size-5 shrink-0" />
            <div dir="auto" className="truncate font-medium" title={set.name}>
              {set.name}
            </div>
          </div>
          {canEdit && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={deleting}
                onClick={() => setEditor(set)}
              >
                {t('Edit')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={deleting}
                onClick={() => void handleDelete(set.id)}
              >
                {t('Delete')}
              </Button>
            </div>
          )}
        </div>
      ))}
      {followSets.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {isLoading ? t('loading...') : t('No follow lists yet')}
        </p>
      )}
      {canEdit && (
        <Button variant="outline" disabled={deleting} onClick={() => setEditor('new')}>
          <Plus />
          {t('New follow list')}
        </Button>
      )}
    </div>
  )
}
