import { KIND_FILTER_OPTIONS } from '@/components/KindFilter'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerOverlay,
  DrawerTitle
} from '@/components/ui/drawer'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_FEED_TABS } from '@/constants'
import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { TFeedTabConfig } from '@/types'
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowLeft, GripVertical, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

type TEditorState = { mode: 'add' } | { mode: 'edit'; id: string } | null

export default function FeedTabsCustomizeDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { feedTabs, updateFeedTabs } = useUserPreferences()
  const [editor, setEditor] = useState<TEditorState>(null)
  const drawerContentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      setEditor(null)
    }
  }, [open])

  // Keep the drawer above the mobile virtual keyboard.
  useEffect(() => {
    if (!isSmallScreen || !open) return
    const vv = window.visualViewport
    if (!vv) return
    const handleResize = () => {
      if (!drawerContentRef.current) return
      const keyboardHeight = Math.max(window.innerHeight - vv.height - vv.offsetTop, 0)
      drawerContentRef.current.style.bottom = `${keyboardHeight}px`
    }
    vv.addEventListener('resize', handleResize)
    vv.addEventListener('scroll', handleResize)
    handleResize()
    return () => {
      vv.removeEventListener('resize', handleResize)
      vv.removeEventListener('scroll', handleResize)
    }
  }, [isSmallScreen, open])

  const editingTab = useMemo(() => {
    if (!editor) return null
    if (editor.mode === 'add') return null
    return feedTabs.find((tab) => tab.id === editor.id) ?? null
  }, [editor, feedTabs])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = feedTabs.findIndex((t) => t.id === active.id)
    const newIndex = feedTabs.findIndex((t) => t.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    updateFeedTabs(arrayMove(feedTabs, oldIndex, newIndex))
  }

  const handleToggleHidden = (id: string) => {
    updateFeedTabs(feedTabs.map((tab) => (tab.id === id ? { ...tab, hidden: !tab.hidden } : tab)))
  }

  const handleDelete = (id: string) => {
    updateFeedTabs(feedTabs.filter((tab) => tab.id !== id))
  }

  const handleReset = () => {
    updateFeedTabs(DEFAULT_FEED_TABS.map((tab) => ({ ...tab })))
  }

  const handleSaveEditor = (draft: Omit<TFeedTabConfig, 'id'> & { id?: string }) => {
    if (editor?.mode === 'edit' && draft.id) {
      updateFeedTabs(
        feedTabs.map((tab) =>
          tab.id === draft.id
            ? { ...tab, label: draft.label, kinds: draft.kinds, hideReplies: draft.hideReplies }
            : tab
        )
      )
    } else {
      const newTab: TFeedTabConfig = {
        id: `custom-${randomString(8)}`,
        label: draft.label,
        kinds: draft.kinds,
        hideReplies: draft.hideReplies
      }
      updateFeedTabs([...feedTabs, newTab])
    }
    setEditor(null)
  }

  const title = editor
    ? editor.mode === 'add'
      ? t('Add tab')
      : t('Edit tab')
    : t('Customize tabs')
  const description = !editor ? t('Reorder, hide or add tabs to the feed.') : null
  const showBack = !!editor

  const body = editor ? (
    <TabEditor
      initial={editingTab}
      onSave={handleSaveEditor}
      onCancel={() => setEditor(null)}
      autoFocusLabel={!isSmallScreen}
    />
  ) : (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext
          items={feedTabs.map((tab) => tab.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-2">
            {feedTabs.map((tab) => (
              <TabRow
                key={tab.id}
                tab={tab}
                onToggleHidden={() => handleToggleHidden(tab.id)}
                onEdit={() => setEditor({ mode: 'edit', id: tab.id })}
                onDelete={() => handleDelete(tab.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button variant="secondary" className="w-full" onClick={() => setEditor({ mode: 'add' })}>
        <Plus size={16} />
        {t('Add tab')}
      </Button>
      <div className="flex justify-end pt-1">
        <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
          <RotateCcw size={16} />
          {t('Reset to default')}
        </Button>
      </div>
    </div>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerOverlay onClick={() => onOpenChange(false)} />
        <DrawerContent
          hideOverlay
          ref={drawerContentRef}
          className="max-h-[90vh] overflow-y-auto px-4 pb-4"
        >
          <DrawerHeader className="px-0">
            <DrawerTitle className="flex items-center gap-2">
              {showBack && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="-ml-2 size-7"
                  onClick={() => setEditor(null)}
                >
                  <ArrowLeft size={16} />
                </Button>
              )}
              {title}
            </DrawerTitle>
            {description && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {showBack && (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 size-7"
                onClick={() => setEditor(null)}
              >
                <ArrowLeft size={16} />
              </Button>
            )}
            {title}
          </DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}

function TabRow({
  tab,
  onToggleHidden,
  onEdit,
  onDelete
}: {
  tab: TFeedTabConfig
  onToggleHidden: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tab.id
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }
  const isBuiltin = !!tab.builtin

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-1 rounded-lg border px-1 py-1.5',
        tab.hidden && 'opacity-60'
      )}
    >
      <div
        className="cursor-grab touch-none rounded p-2 hover:bg-muted active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1 truncate text-sm font-medium">{t(tab.label)}</div>
      <Switch
        checked={!tab.hidden}
        onCheckedChange={onToggleHidden}
        aria-label={t('Show tab')}
      />
      {!isBuiltin && (
        <>
          <Button variant="ghost" size="icon" onClick={onEdit}>
            <Pencil size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </Button>
        </>
      )}
    </div>
  )
}

function TabEditor({
  initial,
  onSave,
  onCancel,
  autoFocusLabel
}: {
  initial: TFeedTabConfig | null
  onSave: (draft: Omit<TFeedTabConfig, 'id'> & { id?: string }) => void
  onCancel: () => void
  autoFocusLabel: boolean
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(initial?.label ?? '')
  const [hideReplies, setHideReplies] = useState(initial?.hideReplies ?? false)
  const [kinds, setKinds] = useState<number[]>(initial?.kinds ?? [])

  const canSubmit = label.trim().length > 0 && kinds.length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    onSave({
      id: initial?.id,
      label: label.trim(),
      hideReplies,
      kinds: [...kinds].sort((a, b) => a - b)
    })
  }

  const toggleKindGroup = (group: number[]) => {
    const active = group.every((k) => kinds.includes(k))
    if (active) {
      setKinds((prev) => prev.filter((k) => !group.includes(k)))
    } else {
      setKinds((prev) => Array.from(new Set([...prev, ...group])))
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="feed-tab-name">{t('Tab name')}</Label>
        <Input
          id="feed-tab-name"
          value={label}
          autoFocus={autoFocusLabel}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t('e.g. Highlights')}
          maxLength={40}
        />
      </div>

      <Label className="flex cursor-pointer items-center justify-between">
        <span className="text-sm font-medium">{t('Hide replies')}</span>
        <Switch checked={hideReplies} onCheckedChange={setHideReplies} />
      </Label>

      <div className="space-y-2">
        <Label>{t('Event kinds')}</Label>
        <div className="grid grid-cols-2 gap-2">
          {KIND_FILTER_OPTIONS.map(({ kindGroup, label: groupLabel }) => {
            const checked = kindGroup.every((k) => kinds.includes(k))
            return (
              <div
                key={groupLabel}
                className={cn(
                  'grid cursor-pointer gap-1.5 rounded-lg border px-3 py-2',
                  checked ? 'border-primary/60 bg-primary/5' : 'clickable'
                )}
                onClick={() => toggleKindGroup(kindGroup)}
              >
                <p className="text-sm font-medium leading-none">{t(groupLabel)}</p>
                <p className="text-xs text-muted-foreground">kind {kindGroup.join(', ')}</p>
              </div>
            )
          })}
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t('Cancel')}
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {t('Save')}
        </Button>
      </DialogFooter>
    </div>
  )
}
