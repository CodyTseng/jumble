import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { StorageKey } from '@/constants'
import { Dispatch, SetStateAction, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TPostOptions } from './types'

export default function PostOptions({
  show,
  postOptions,
  setPostOptions
}: {
  show: boolean
  postOptions: TPostOptions
  setPostOptions: Dispatch<SetStateAction<TPostOptions>>
}) {
  const { t } = useTranslation()

  useEffect(() => {
    setPostOptions((prev) => ({
      ...prev,
      addClientTag: window.localStorage.getItem(StorageKey.ADD_CLIENT_TAG) === 'true'
    }))
  }, [])

  if (!show) return null

  const onAddClientTagChange = (checked: boolean) => {
    setPostOptions((prev) => ({ ...prev, addClientTag: checked }))
    window.localStorage.setItem(StorageKey.ADD_CLIENT_TAG, checked.toString())
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Label htmlFor="add-client-tag">{t('Add client tag')}</Label>
        <Switch
          id="add-client-tag"
          checked={postOptions.addClientTag}
          onCheckedChange={onAddClientTagChange}
        />
      </div>
      <div className="text-muted-foreground text-xs">
        {t('Show others this was sent via Jumble')}
      </div>
    </div>
  )
}
