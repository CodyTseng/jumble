import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { normalizeUrl } from '@/lib/url'
import { TPollCreateData } from '@/types'
import dayjs from 'dayjs'
import { Eraser, X } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AlertCard from '../AlertCard'

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
    <div className="space-y-4 border rounded-lg p-3">
      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex gap-2">
            <Input
              value={option}
              onChange={(e) => handleOptionChange(index, e.target.value)}
              placeholder={t('Option {{number}}', { number: index + 1 })}
            />
            <Button
              type="button"
              variant="ghost-destructive"
              size="icon"
              onClick={() => handleRemoveOption(index)}
              disabled={options.length <= 2}
            >
              <X />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={handleAddOption}>
          {t('Add Option')}
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <Label htmlFor="multiple-choice">{t('Allow multiple choices')}</Label>
        <Switch
          id="multiple-choice"
          checked={isMultipleChoice}
          onCheckedChange={setIsMultipleChoice}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="ends-at">{t('End Date (optional)')}</Label>
        <div className="flex items-center gap-2">
          <Input
            id="ends-at"
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
          />
          <Button
            type="button"
            variant="ghost-destructive"
            size="icon"
            onClick={() => setEndsAt('')}
            disabled={!endsAt}
            title={t('Clear end date')}
          >
            <Eraser />
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="relay-urls">{t('Relay URLs (optional, comma-separated)')}</Label>
        <Input
          id="relay-urls"
          value={relayUrls}
          onChange={(e) => setRelayUrls(e.target.value)}
          placeholder="wss://relay1.com, wss://relay2.com"
        />
      </div>

      <div className="grid gap-2">
        <AlertCard
          title={t('This is a poll note.')}
          content={t(
            'Unlike regular notes, polls are not widely supported and may not display on other clients.'
          )}
        />

        <Button variant="ghost-destructive" className="w-full" onClick={() => setIsPoll(false)}>
          {t('Remove poll')}
        </Button>
      </div>
    </div>
  )
}
