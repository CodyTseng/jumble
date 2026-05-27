import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { normalizeUrl } from '@/lib/url'
import { TPollCreateData } from '@/types'
import dayjs from 'dayjs'
import { ChevronRight, Eraser, Plus, Trash2, TriangleAlert, X } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const inputClass =
  'h-9 rounded-md border-0 bg-muted/40 transition-colors duration-200 hover:bg-muted/50 focus-visible:bg-muted/60 focus-visible:ring-0 focus-visible:border-0'

export default function PollEditor({
  pollCreateData,
  setPollCreateData,
  setIsPoll
}: {
  pollCreateData: TPollCreateData
  setPollCreateData: Dispatch<SetStateAction<TPollCreateData>>
  setIsPoll: Dispatch<SetStateAction<boolean>>
}) {
  const { t } = useTranslation()
  const [isMultipleChoice, setIsMultipleChoice] = useState(pollCreateData.isMultipleChoice)
  const [options, setOptions] = useState(pollCreateData.options)
  const [endsAt, setEndsAt] = useState(
    pollCreateData.endsAt ? dayjs(pollCreateData.endsAt * 1000).format('YYYY-MM-DDTHH:mm') : ''
  )
  const [relayUrls, setRelayUrls] = useState(pollCreateData.relays.join(', '))
  const [showAdvanced, setShowAdvanced] = useState(pollCreateData.relays.length > 0)

  useEffect(() => {
    setPollCreateData({
      isMultipleChoice,
      options,
      endsAt: endsAt ? dayjs(endsAt).startOf('minute').unix() : undefined,
      relays: relayUrls
        ? relayUrls
            .split(',')
            .map((url) => normalizeUrl(url.trim()))
            .filter(Boolean)
        : []
    })
  }, [isMultipleChoice, options, endsAt, relayUrls])

  const handleAddOption = () => {
    setOptions([...options, ''])
  }

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options]
    newOptions[index] = value
    setOptions(newOptions)
  }

  return (
    <div className="overflow-hidden rounded-2xl border">
      <div className="space-y-2 p-3">
        {options.map((option, index) => (
          <div key={index} className="group relative">
            <div className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-xs font-medium tabular-nums text-muted-foreground">
              {index + 1}.
            </div>
            <Input
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={t('Option {{number}}', { number: index + 1 })}
              className={cn(inputClass, 'ps-9 pe-10')}
              maxLength={200}
            />
            {options.length > 2 && (
              <button
                type="button"
                onClick={() => handleRemoveOption(index)}
                title={t('Remove')}
                className="absolute inset-y-0 end-2 my-auto flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={handleAddOption}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-md text-sm text-muted-foreground transition-colors duration-200 hover:bg-muted/40 hover:text-foreground"
        >
          <Plus className="size-4" />
          {t('Add Option')}
        </button>
      </div>

      <div className="h-px bg-border" />

      <div className="px-3 py-2">
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 py-1.5">
            <Label htmlFor="multiple-choice" className="cursor-pointer text-sm font-normal">
              {t('Allow multiple choices')}
            </Label>
            <Switch
              id="multiple-choice"
              checked={isMultipleChoice}
              onCheckedChange={setIsMultipleChoice}
            />
          </div>
          <div className="flex items-center justify-between gap-3 py-1.5">
            <Label htmlFor="ends-at" className="cursor-pointer text-sm font-normal">
              {t('End date')}
            </Label>
            <div className="flex items-center gap-1">
              <Input
                id="ends-at"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className={cn(inputClass, 'h-8 w-auto text-sm')}
              />
              {endsAt && (
                <button
                  type="button"
                  onClick={() => setEndsAt('')}
                  title={t('Clear end date')}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
                >
                  <Eraser className="size-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="py-1.5">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            <ChevronRight
              className={cn(
                'size-3 transition-transform rtl:-scale-x-100',
                showAdvanced && 'rotate-90'
              )}
            />
            {t('Advanced options')}
          </button>
          {showAdvanced && (
            <div className="mt-2 grid gap-1.5">
              <Label htmlFor="relay-urls" className="text-xs text-muted-foreground">
                {t('Relay URLs (optional, comma-separated)')}
              </Label>
              <Input
                id="relay-urls"
                value={relayUrls}
                onChange={(e) => setRelayUrls(e.target.value)}
                placeholder="wss://relay1.com, wss://relay2.com"
                className={cn(inputClass, 'text-sm')}
              />
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="flex items-start gap-2 px-3 py-2 text-xs text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        <span>{t('Polls may not display on clients that don’t support them.')}</span>
      </div>

      <div className="h-px bg-border" />

      <Button
        type="button"
        variant="ghost"
        className="h-9 w-full gap-1.5 rounded-none text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setIsPoll(false)}
      >
        <Trash2 className="size-4" />
        {t('Remove poll')}
      </Button>
    </div>
  )
}
