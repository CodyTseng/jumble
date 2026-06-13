import PostEditor from '@/components/PostEditor'
import { useDraftBox } from '@/providers/DraftBoxProvider'
import { TPostDraftUnsigned } from '@/types/post-draft'

export default function DraftEditorHost() {
  const { editingDraft, finishEditingDraft } = useDraftBox()
  if (!editingDraft || editingDraft.status !== 'draft') return null
  const draft = editingDraft as TPostDraftUnsigned
  return (
    <PostEditor
      open
      setOpen={(next) => {
        if (!next) finishEditingDraft()
      }}
      initialDraft={draft}
    />
  )
}
