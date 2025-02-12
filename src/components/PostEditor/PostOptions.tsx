import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { StorageKey } from '@/constants'
import { Dispatch, SetStateAction, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function PostOptions({
  show,
  addClientTag,
  setAddClientTag
}: {
  show: boolean
  addClientTag: boolean
  setAddClientTag: Dispatch<SetStateAction<boolean>>
}) {
  const { t } = useTranslation()

  useEffect(() => {
    setAddClientTag(window.localStorage.getItem(StorageKey.ADD_CLIENT_TAG) === 'true')
  }, [])

  if (!show) return null

  const onAddClientTagChange = (checked: boolean) => {
    setAddClientTag(checked)
    window.localStorage.setItem(StorageKey.ADD_CLIENT_TAG, checked.toString())
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Label htmlFor="add-client-tag">{t('Add client tag')}</Label>
        <Switch id="add-client-tag" checked={addClientTag} onCheckedChange={onAddClientTagChange} />
      </div>
      <div className="text-muted-foreground text-xs">
        {t('Show others this was sent via Jumble')}
      </div>
    </div>
  )
}
