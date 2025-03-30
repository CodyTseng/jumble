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
    <div className="w-full border rounded-lg p-4">
      <div className="flex justify-between items-center">
        <div className="font-semibold">{t('Add a new relay set')}</div>
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          placeholder={t('Relay set name')}
          value={newRelaySetName}
          onChange={handleNewRelaySetNameChange}
          onKeyDown={handleNewRelaySetNameKeyDown}
          onBlur={saveRelaySet}
        />
        <Button onClick={saveRelaySet}>{t('Add')}</Button>
      </div>
    </div>
  )
}
