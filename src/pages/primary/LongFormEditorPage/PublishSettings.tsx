import { MentionPicker } from '@/components/PostEditor/Mentions'
import PostOptions from '@/components/PostEditor/PostOptions'
import PostRelaySelector from '@/components/PostEditor/PostRelaySelector'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import storage from '@/services/local-storage.service'
import { TLongFormDraft } from '@/types/long-form-draft'
import { CircleHelp, Loader } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Event } from 'nostr-tools'
import { Dispatch, SetStateAction, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export default function PublishSettings({
  draft,
  setDraft,
  publishing,
  editEvent,
  articleMentions,
  open,
  onOpenChange,
  onPublish,
  mentionsLoading
}: {
  draft: TLongFormDraft
  setDraft: Dispatch<SetStateAction<TLongFormDraft>>
  publishing: boolean
  editEvent?: Event
  articleMentions: {
    potentialMentions: string[]
    mentions: string[]
    setMentions: (selected: string[]) => void
  }
  open: boolean
  onOpenChange: (open: boolean) => void
  onPublish: () => void
  mentionsLoading: boolean
}) {
  const { t } = useTranslation()
  const protectedId = useId()
  const dismissedProtected = useRef(draft.isProtectedEvent === false)
  const addClientTag = draft.addClientTag ?? storage.getAddClientTag()
  const minPow = draft.minPow ?? storage.getDefaultMinPow() ?? 0
  const isProtectedEvent =
    draft.isProtectedEvent ?? draft.originalTags?.some(([name]) => name === '-') ?? false
  const isNsfw =
    draft.isNsfw ?? draft.originalTags?.some(([name]) => name === 'content-warning') ?? false

  function setter<K extends keyof TLongFormDraft>(
    key: K,
    fallback: NonNullable<TLongFormDraft[K]>
  ) {
    return (value: SetStateAction<NonNullable<TLongFormDraft[K]>>) => {
      setDraft((current) => {
        const previous = current[key] ?? fallback
        const next =
          typeof value === 'function' ? value(previous as NonNullable<TLongFormDraft[K]>) : value
        if (JSON.stringify(current[key]) === JSON.stringify(next)) return current
        return { ...current, [key]: next, updatedAt: Date.now() }
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,42rem)] max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 pe-14">
          <DialogTitle>{t('Post settings')}</DialogTitle>
          <DialogDescription>{t('Review your post settings before publishing.')}</DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={publishing}
          className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="space-y-3 border-b px-4 py-4">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('Relays')}</span>
              <div className="max-w-56 min-w-0">
                <PostRelaySelector
                  parentEvent={editEvent}
                  initialItems={draft.postTargetItems}
                  onProtectedSuggestionChange={(suggested) => {
                    if (suggested && !dismissedProtected.current)
                      setter('isProtectedEvent', false)(true)
                  }}
                  setAdditionalRelayUrls={setter('additionalRelayUrls', [])}
                  onItemsChange={setter('postTargetItems', [])}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">{t('Mentions')}</span>
              <MentionPicker compact {...articleMentions} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <Label htmlFor={protectedId}>{t('Protected')}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground size-6 rounded-full"
                      aria-label={t('Protected event hint')}
                    >
                      <CircleHelp className="size-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="text-xs leading-relaxed">
                    {t('Protected event hint')}
                  </PopoverContent>
                </Popover>
              </div>
              <Switch
                id={protectedId}
                checked={isProtectedEvent}
                onCheckedChange={(checked) => {
                  if (!checked) dismissedProtected.current = true
                  setter('isProtectedEvent', false)(checked)
                }}
              />
            </div>
            {isProtectedEvent && !draft.additionalRelayUrls?.length && (
              <p className="text-destructive text-xs">{t('No relays selected')}</p>
            )}
          </div>
          <div className="px-4 py-4">
            <PostOptions
              posting={publishing}
              show
              addClientTag={addClientTag}
              setAddClientTag={setter('addClientTag', addClientTag)}
              isNsfw={isNsfw}
              setIsNsfw={setter('isNsfw', false)}
              minPow={minPow}
              setMinPow={setter('minPow', minPow)}
            />
          </div>
        </fieldset>
        <DialogFooter className="border-t px-5 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            {t('Cancel')}
          </Button>
          <Button
            onClick={onPublish}
            disabled={
              publishing ||
              mentionsLoading ||
              (isProtectedEvent && !draft.additionalRelayUrls?.length)
            }
          >
            {publishing && <Loader className="animate-spin" />}
            {publishing ? t('Publishing...') : t('Publish')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
