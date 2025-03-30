import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { normalizeUrl } from '@/lib/url'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function AddNewRelay() {
  const { t } = useTranslation()
  const { favoriteRelays, addFavoriteRelays } = useFavoriteRelays()
  const [input, setInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const saveRelay = async () => {
    if (!input) return
    const normalizedUrl = normalizeUrl(input)
    if (!normalizedUrl) {
      setErrorMsg(t('Invalid URL'))
      return
    }
    if (favoriteRelays.includes(normalizedUrl)) {
      setErrorMsg(t('Already saved'))
      return
    }
    await addFavoriteRelays([normalizedUrl])
    setInput('')
  }

  const handleNewRelaySetNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    setErrorMsg('')
  }

  const handleNewRelaySetNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveRelay()
    }
  }

  return (
    <div className="w-full border rounded-lg p-4">
      <div className="flex justify-between items-center">
        <div className="font-semibold">{t('Add a new relay')}</div>
      </div>
      <div className="mt-2">
        <div className="flex gap-2">
          <Input
            placeholder={t('Relay set name')}
            value={input}
            onChange={handleNewRelaySetNameChange}
            onKeyDown={handleNewRelaySetNameKeyDown}
            onBlur={saveRelay}
            className={errorMsg ? 'border-destructive' : ''}
          />
          <Button onClick={saveRelay}>{t('Add')}</Button>
        </div>
        {errorMsg && <div className="text-destructive text-sm">{errorMsg}</div>}
      </div>
    </div>
  )
}
