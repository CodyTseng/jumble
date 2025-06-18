import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslationService } from '@/providers/TranslationServiceProvider'
import { useEffect, useRef, useState } from 'react'

export default function LibreTranslate() {
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
      <div>
        <Label>
          Server Address:
          <Input
            type="text"
            value={server}
            onChange={(e) => setServer(e.target.value)}
            placeholder="Enter server address"
          />
        </Label>
      </div>
      <div>
        <Label>
          API Key:
          <Input
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter API Key"
          />
        </Label>
      </div>
    </div>
  )
}
