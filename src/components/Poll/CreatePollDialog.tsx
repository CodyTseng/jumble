import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useNostr } from '@/providers/NostrProvider'
import { TPollType } from '@/types'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExtendedKind } from '@/constants'
import client from '@/services/client.service'

interface CreatePollDialogProps {
  trigger?: React.ReactNode
}

export default function CreatePollDialog({ trigger }: CreatePollDialogProps) {
  const { t } = useTranslation()
  const { signEvent } = useNostr()
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [isMultipleChoice, setIsMultipleChoice] = useState(false)
  const [endsAt, setEndsAt] = useState('')
  const [relayUrls, setRelayUrls] = useState('')

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

  const generateOptionId = () => {
    return Math.random().toString(36).substring(2, 10)
  }

  const handleCreatePoll = async () => {
    if (!question.trim() || options.some(opt => !opt.trim())) {
      return
    }

    setIsCreating(true)
    try {
      const validOptions = options.filter(opt => opt.trim())
      const pollType: TPollType = isMultipleChoice ? 'multiplechoice' : 'singlechoice'
      
      const tags = [
        ...validOptions.map(option => ['option', generateOptionId(), option.trim()]),
        ['polltype', pollType]
      ]

      if (endsAt) {
        const timestamp = new Date(endsAt).getTime() / 1000
        if (!isNaN(timestamp)) {
          tags.push(['endsAt', timestamp.toString()])
        }
      }

      if (relayUrls.trim()) {
        const urls = relayUrls.split(',').map(url => url.trim()).filter(url => url)
        urls.forEach(url => tags.push(['relay', url]))
      }

      const draftEvent = {
        content: question.trim(),
        kind: ExtendedKind.POLL,
        created_at: Math.floor(Date.now() / 1000),
        tags
      }

      const signedEvent = await signEvent(draftEvent)
      
      // Publish to relays
      await client.publishEvent(client.getCurrentRelayUrls(), signedEvent)
      
      // Reset form
      setQuestion('')
      setOptions(['', ''])
      setIsMultipleChoice(false)
      setEndsAt('')
      setRelayUrls('')
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to create poll:', error)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline">{t('Create Poll')}</Button>}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('Create a Poll')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="question">{t('Question')}</Label>
            <Textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t('Enter your poll question...')}
              className="mt-1"
            />
          </div>

          <div>
            <Label>{t('Options')}</Label>
            <div className="space-y-2 mt-1">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    placeholder={t(`Option ${index + 1}`)}
                  />
                  {options.length > 2 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveOption(index)}
                    >
                      {t('Remove')}
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddOption}
              >
                {t('Add Option')}
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="multiple-choice"
              checked={isMultipleChoice}
              onCheckedChange={setIsMultipleChoice}
            />
            <Label htmlFor="multiple-choice">{t('Allow multiple choices')}</Label>
          </div>

          <div>
            <Label htmlFor="ends-at">{t('End Date (optional)')}</Label>
            <Input
              id="ends-at"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="relay-urls">{t('Relay URLs (optional, comma-separated)')}</Label>
            <Input
              id="relay-urls"
              value={relayUrls}
              onChange={(e) => setRelayUrls(e.target.value)}
              placeholder="wss://relay1.com, wss://relay2.com"
              className="mt-1"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              {t('Cancel')}
            </Button>
            <Button 
              onClick={handleCreatePoll}
              disabled={isCreating || !question.trim() || options.some(opt => !opt.trim())}
            >
              {isCreating ? t('Creating...') : t('Create Poll')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 