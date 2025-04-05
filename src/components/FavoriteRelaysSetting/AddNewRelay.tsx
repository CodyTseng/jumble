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

  const handleNewRelayInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
    setErrorMsg('')
  }

  const handleNewRelayInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveRelay()
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2 items-center">
        <Input
          placeholder={t('Add a new relay')}
          value={input}
          onChange={handleNewRelayInputChange}
          onKeyDown={handleNewRelayInputKeyDown}
          className={errorMsg ? 'border-destructive' : ''}
        />
        <Button onClick={saveRelay}>{t('Add')}</Button>
      </div>
      {errorMsg && <div className="text-destructive text-sm pl-8">{errorMsg}</div>}
    </div>
  )
}
