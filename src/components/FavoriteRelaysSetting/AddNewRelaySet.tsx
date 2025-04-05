import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function AddNewRelaySet() {
  const { t } = useTranslation()
  const { addRelaySet } = useFavoriteRelays()
  const [newRelaySetName, setNewRelaySetName] = useState('')

  const saveRelaySet = () => {
    if (!newRelaySetName) return
    addRelaySet(newRelaySetName)
    setNewRelaySetName('')
  }

  const handleNewRelaySetNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewRelaySetName(e.target.value)
  }

  const handleNewRelaySetNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveRelaySet()
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2 items-center">
        <Input
          placeholder={t('Add a new relay set')}
          value={newRelaySetName}
          onChange={handleNewRelaySetNameChange}
          onKeyDown={handleNewRelaySetNameKeyDown}
        />
        <Button onClick={saveRelaySet}>{t('Add')}</Button>
      </div>
    </div>
  )
}
