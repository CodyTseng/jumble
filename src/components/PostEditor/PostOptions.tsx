import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import storage from '@/services/local-storage.service'
import { Dispatch, SetStateAction, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function PostOptions({
  posting,
  show,
  addClientTag,
  setAddClientTag,
  isNsfw,
  setIsNsfw,
  minPow,
  setMinPow
}: {
  posting: boolean
  show: boolean
  addClientTag: boolean
  setAddClientTag: Dispatch<SetStateAction<boolean>>
  isNsfw: boolean
  setIsNsfw: Dispatch<SetStateAction<boolean>>
  minPow: number
  setMinPow: Dispatch<SetStateAction<number>>
}) {
  const { t } = useTranslation()
  const id = useId()
  const [rememberPow, setRememberPow] = useState(storage.getDefaultMinPow() !== null)

  if (!show) return null

  const onAddClientTagChange = (checked: boolean) => {
    setAddClientTag(checked)
    storage.setAddClientTag(checked)
  }

  const onNsfwChange = (checked: boolean) => {
    setIsNsfw(checked)
  }

  const onMinPowChange = (pow: number) => {
    setMinPow(pow)
    if (rememberPow) {
      storage.setDefaultMinPow(pow)
    }
  }

  const onRememberPowChange = (checked: boolean) => {
    setRememberPow(checked)
    storage.setDefaultMinPow(checked ? minPow : null)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={`${id}-add-client-tag`}>{t('Add client tag')}</Label>
          <Switch
            id={`${id}-add-client-tag`}
            checked={addClientTag}
            onCheckedChange={onAddClientTagChange}
            disabled={posting}
          />
        </div>
        <div className="text-muted-foreground text-xs">
          {t('Show others this was sent via Jumble')}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`${id}-add-nsfw-tag`}>{t('NSFW')}</Label>
        <Switch
          id={`${id}-add-nsfw-tag`}
          checked={isNsfw}
          onCheckedChange={onNsfwChange}
          disabled={posting}
        />
      </div>

      <div className="grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <Label>{t('Proof of Work (difficulty {{minPow}})', { minPow })}</Label>
          <div className="ms-auto flex shrink-0 items-center gap-2">
            <Label
              htmlFor={`${id}-remember-pow`}
              className="text-muted-foreground cursor-pointer font-normal"
            >
              {t('Remember this difficulty')}
            </Label>
            <Switch
              id={`${id}-remember-pow`}
              checked={rememberPow}
              onCheckedChange={onRememberPowChange}
              disabled={posting}
            />
          </div>
        </div>
        <Slider
          defaultValue={[0]}
          value={[minPow]}
          onValueChange={([pow]) => onMinPowChange(pow)}
          max={28}
          step={1}
          disabled={posting}
        />
      </div>
    </div>
  )
}
