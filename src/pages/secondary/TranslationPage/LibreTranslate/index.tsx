import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function LibreTranslate() {
  const { t } = useTranslation()
  const { config, updateConfig } = useTranslationService()
  const [server, setServer] = useState(
    config.service === 'libre_translate' ? (config.server ?? '') : ''
  )
  const [apiKey, setApiKey] = useState(
    config.service === 'libre_translate' ? (config.api_key ?? '') : ''
  )
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      return
    }

    updateConfig({
      service: 'libre_translate',
      server,
      api_key: apiKey
    })
  }, [server, apiKey])

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="libre-translate-server" className="text-base">
          {t('Service address')}
        </Label>
        <Input
          id="libre-translate-server"
          type="text"
          value={server}
          onChange={(e) => setServer(e.target.value)}
          placeholder="Enter server address"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="libre-translate-api-key" className="text-base">
          API key
        </Label>
        <Input
          id="libre-translate-api-key"
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Enter API Key"
        />
      </div>
    </div>
  )
}
