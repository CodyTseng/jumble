import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { DEFAULT_NOTIFICATION_FILTERS, DEFAULT_NOTIFICATION_TABS } from '@/constants'
import { prefersTouchInteraction } from '@/lib/device'
import { randomString } from '@/lib/random'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import { TNotificationFilter, TNotificationTabConfig } from '@/types'
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
import {
  ArrowLeft,
  AtSign,
  GripVertical,
  Heart,
  Highlighter,
  MessageCircle,
  Pencil,
  Plus,
  Quote,
  Repeat,
  RotateCcw,
  Trash2,
  Vote,
  Zap
} from 'lucide-react'
import { ComponentType, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const FILTER_OPTIONS: {
  value: TNotificationFilter
  label: string
  icon: ComponentType
  activeClassName: string
}[] = [
  {
    value: 'mentions',
    label: 'Mentions',
    icon: AtSign,
    activeClassName:
      'aria-pressed:bg-pink-400/10 aria-pressed:text-pink-400 aria-pressed:ring-pink-400/30'
  },
  {
    value: 'replies',
    label: 'Replies',
    icon: MessageCircle,
    activeClassName:
      'aria-pressed:bg-blue-400/10 aria-pressed:text-blue-400 aria-pressed:ring-blue-400/30'
  },
  {
    value: 'quotes',
    label: 'Quotes',
    icon: Quote,
    activeClassName:
      'aria-pressed:bg-emerald-400/10 aria-pressed:text-emerald-400 aria-pressed:ring-emerald-400/30'
  },
  {
    value: 'highlights',
    label: 'Highlights',
    icon: Highlighter,
    activeClassName:
      'aria-pressed:bg-orange-400/10 aria-pressed:text-orange-400 aria-pressed:ring-orange-400/30'
  },
  {
    value: 'reposts',
    label: 'Reposts',
    icon: Repeat,
    activeClassName:
      'aria-pressed:bg-green-400/10 aria-pressed:text-green-400 aria-pressed:ring-green-400/30'
  },
  {
    value: 'likes',
    label: 'Like',
    icon: Heart,
    activeClassName:
      'aria-pressed:bg-rose-400/10 aria-pressed:text-rose-400 aria-pressed:ring-rose-400/30'
  },
  {
    value: 'pollResponses',
    label: 'Poll',
    icon: Vote,
    activeClassName:
      'aria-pressed:bg-violet-400/10 aria-pressed:text-violet-400 aria-pressed:ring-violet-400/30'
  },
  {
    value: 'zaps',
    label: 'Zaps',
    icon: Zap,
    activeClassName:
      'aria-pressed:bg-yellow-400/10 aria-pressed:text-yellow-400 aria-pressed:ring-yellow-400/30'
  }
]

type TEditorState = { mode: 'add' } | { mode: 'edit'; id: string } | null

export default function NotificationTabsCustomizeDialog({
  open,
  onOpenChange
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { notificationTabs, updateNotificationTabs } = useUserPreferences()
  const [editor, setEditor] = useState<TEditorState>(null)
  const prefersTouch = useMemo(() => prefersTouchInteraction(), [])
  const visibleTabCount = notificationTabs.filter((tab) => !tab.hidden).length
  const editingTab = useMemo(() => {
    if (editor?.mode !== 'edit') return null
    return notificationTabs.find((tab) => tab.id === editor.id) ?? null
  }, [editor, notificationTabs])
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (!open) setEditor(null)
  }, [open])

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const oldIndex = notificationTabs.findIndex((tab) => tab.id === active.id)
    const newIndex = notificationTabs.findIndex((tab) => tab.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    updateNotificationTabs(arrayMove(notificationTabs, oldIndex, newIndex))
  }

  const updateTab = (
    tabId: string,
    update: (tab: TNotificationTabConfig) => TNotificationTabConfig
  ) => {
    updateNotificationTabs(notificationTabs.map((tab) => (tab.id === tabId ? update(tab) : tab)))
  }

  const toggleFilter = (tabId: string, filter: TNotificationFilter) => {
    updateTab(tabId, (tab) => {
      const filters = new Set(tab.filters)
      if (filters.has(filter)) filters.delete(filter)
      else filters.add(filter)
      return {
        ...tab,
        filters: DEFAULT_NOTIFICATION_FILTERS.filter((item) => filters.has(item))
      }
    })
  }

  const handleSaveEditor = (label: string, filters: TNotificationFilter[]) => {
    if (editor?.mode === 'edit') {
      updateTab(editor.id, (tab) => ({ ...tab, label, filters }))
    } else {
      updateNotificationTabs([
        ...notificationTabs,
        { id: `custom-${randomString(8)}`, label, filters }
      ])
    }
    setEditor(null)
  }

  const handleReset = () => {
    updateNotificationTabs(
      DEFAULT_NOTIFICATION_TABS.map((tab) => ({ ...tab, filters: [...tab.filters] }))
    )
  }

  const list = (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      >
        <SortableContext
          items={notificationTabs.map((tab) => tab.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="grid gap-3">
            {notificationTabs.map((tab) => (
              <TabRow
                key={tab.id}
                tab={tab}
                mobile={isSmallScreen}
                disableHide={!tab.hidden && visibleTabCount === 1}
                onToggle={(filter) => toggleFilter(tab.id, filter)}
                onToggleHidden={() =>
                  updateTab(tab.id, (current) => ({ ...current, hidden: !current.hidden }))
                }
                onEdit={() => setEditor({ mode: 'edit', id: tab.id })}
                onDelete={() =>
                  updateNotificationTabs(notificationTabs.filter((item) => item.id !== tab.id))
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <Button
        variant="outline"
        className="h-10 w-full rounded-xl border-dashed"
        onClick={() => setEditor({ mode: 'add' })}
      >
        <Plus />
        {t('Add tab')}
      </Button>
      <div className="flex justify-end">
        <Button
          variant="ghost"
          className="text-muted-foreground w-full sm:w-auto"
          onClick={handleReset}
        >
          <RotateCcw />
          {t('Reset to default')}
        </Button>
      </div>
    </div>
  )

  const body = editor ? (
    <TabEditor
      initial={editingTab}
      mobile={isSmallScreen}
      autoFocusLabel={!isSmallScreen || !prefersTouch}
      onSave={handleSaveEditor}
      onCancel={() => setEditor(null)}
    />
  ) : (
    list
  )
  const title = editor
    ? editor.mode === 'add'
      ? t('Add tab')
      : t('Edit tab')
    : t('Customize tabs')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl" bodyClassName="overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {editor && (
              <Button
                variant="ghost"
                size="icon"
                className="-ms-2 size-7"
                onClick={() => setEditor(null)}
              >
                <ArrowLeft className="rtl:-scale-x-100" />
              </Button>
            )}
            {title}
          </DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}

function TabRow({
  tab,
  mobile,
  disableHide,
  onToggle,
  onToggleHidden,
  onEdit,
  onDelete
}: {
  tab: TNotificationTabConfig
  mobile: boolean
  disableHide: boolean
  onToggle: (filter: TNotificationFilter) => void
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
    transition
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'bg-card rounded-2xl border p-3 shadow-xs',
        isDragging ? 'opacity-50' : tab.hidden && 'opacity-55'
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <div
          data-drawer-swipe-lock
          className="text-muted-foreground hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-card -ms-1 flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">{t(tab.label)}</div>
        {!tab.builtin && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8 rounded-full"
              aria-label={t('Edit tab')}
              title={t('Edit tab')}
              onClick={onEdit}
            >
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive size-8 rounded-full"
              aria-label={t('Delete')}
              title={t('Delete')}
              onClick={onDelete}
              disabled={disableHide}
            >
              <Trash2 />
            </Button>
          </>
        )}
        <Switch
          checked={!tab.hidden}
          disabled={disableHide}
          onCheckedChange={onToggleHidden}
          aria-label={t('Show tab')}
          className="ms-1"
        />
      </div>
      <div
        className={cn(
          'mt-2.5 grid gap-1.5 border-t pt-2.5',
          mobile ? 'grid-cols-4' : 'grid-cols-8'
        )}
      >
        <FilterToggles filters={tab.filters} onToggle={onToggle} disabled={tab.hidden} showLabels />
      </div>
    </div>
  )
}

function FilterToggles({
  filters,
  onToggle,
  disabled = false,
  showLabels = false
}: {
  filters: TNotificationFilter[]
  onToggle: (filter: TNotificationFilter) => void
  disabled?: boolean
  showLabels?: boolean
}) {
  const { t } = useTranslation()
  return FILTER_OPTIONS.map(({ value, label, icon: Icon, activeClassName }) => {
    const checked = filters.includes(value)
    return (
      <Button
        key={value}
        variant="toggle"
        size="icon"
        className={cn(
          showLabels
            ? 'bg-muted/25 h-12 w-full flex-col gap-1 rounded-xl border border-transparent px-1 py-1.5 text-[10px] leading-none [&_svg]:size-[18px]'
            : 'size-8',
          !disabled && activeClassName,
          (disabled || !checked) && 'text-muted-foreground',
          disabled && 'aria-pressed:bg-transparent aria-pressed:ring-0'
        )}
        aria-pressed={checked}
        aria-label={t(label)}
        title={t(label)}
        disabled={disabled}
        onClick={() => onToggle(value)}
      >
        <Icon />
        {showLabels && <span className="max-w-full truncate">{t(label)}</span>}
      </Button>
    )
  })
}

function TabEditor({
  initial,
  mobile,
  autoFocusLabel,
  onSave,
  onCancel
}: {
  initial: TNotificationTabConfig | null
  mobile: boolean
  autoFocusLabel: boolean
  onSave: (label: string, filters: TNotificationFilter[]) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [label, setLabel] = useState(initial?.label ?? '')
  const [filters, setFilters] = useState<TNotificationFilter[]>(
    initial?.filters ?? DEFAULT_NOTIFICATION_FILTERS
  )
  const canSave = label.trim().length > 0 && filters.length > 0

  const toggleFilter = (filter: TNotificationFilter) => {
    const next = new Set(filters)
    if (next.has(filter)) next.delete(filter)
    else next.add(filter)
    setFilters(DEFAULT_NOTIFICATION_FILTERS.filter((item) => next.has(item)))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="notification-tab-name">{t('Tab name')}</Label>
        <Input
          id="notification-tab-name"
          value={label}
          autoFocus={autoFocusLabel}
          maxLength={40}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label>{t('Notifications')}</Label>
        <div className={cn('grid gap-1.5', mobile ? 'grid-cols-4' : 'grid-cols-8')}>
          <FilterToggles filters={filters} onToggle={toggleFilter} showLabels />
        </div>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t('Cancel')}
        </Button>
        <Button disabled={!canSave} onClick={() => onSave(label.trim(), [...filters])}>
          {t('Save')}
        </Button>
      </DialogFooter>
    </div>
  )
}
