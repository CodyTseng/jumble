import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useNostr } from '@renderer/providers/NostrProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function BunkerLogin({ onLoginSuccess }: { onLoginSuccess: () => void }) {
  const { t } = useTranslation()
  const { bunkerLogin } = useNostr()
  const [bunkerInput, setBunkerInput] = useState('')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBunkerInput(e.target.value)
    setErrMsg(null)
  }

  const handleLogin = () => {
    if (bunkerInput === '') return

    bunkerLogin(bunkerInput)
      .then(() => onLoginSuccess())
      .catch((err) => {
        setErrMsg(err.message)
      })
  }

  return (
    <>
      <div className="space-y-1">
        <Input
          placeholder="bunker://..."
          value={bunkerInput}
          onChange={handleInputChange}
          className={errMsg ? 'border-destructive' : ''}
        />
        {errMsg && <div className="text-xs text-destructive pl-3">{errMsg}</div>}
      </div>
      <Button onClick={handleLogin}>{t('Login')}</Button>
    </>
  )
}
