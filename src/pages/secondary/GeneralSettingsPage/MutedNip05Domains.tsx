import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SettingsRow } from '@/components/ui/settings'
import { normalizeNip05Domain } from '@/lib/muted-nip05'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import { Plus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function MutedNip05Domains() {
  const { t } = useTranslation()
  const { mutedNip05Domains, setMutedNip05Domains } = useContentPolicy()
  const [newDomain, setNewDomain] = useState('')
  const normalizedDomain = normalizeNip05Domain(newDomain)

  const handleAddDomain = () => {
    if (normalizedDomain && !mutedNip05Domains.includes(normalizedDomain)) {
      setMutedNip05Domains([...mutedNip05Domains, normalizedDomain])
      setNewDomain('')
    }
  }

  const handleRemoveDomain = (domain: string) => {
    setMutedNip05Domains(mutedNip05Domains.filter((d) => d !== domain))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddDomain()
    }
  }

  return (
    <SettingsRow
      layout="stacked"
      title={t('Muted NIP-05 domains')}
      description={t('Hide notes from these NIP-05 domains unless you follow the author')}
    >
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder={t('Add NIP-05 domain')}
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleAddDomain}
            disabled={!normalizedDomain || mutedNip05Domains.includes(normalizedDomain)}
          >
            <Plus />
          </Button>
        </div>
        {mutedNip05Domains.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {mutedNip05Domains.map((domain) => (
              <div
                key={domain}
                className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-sm"
              >
                <span>{domain}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 hover:bg-transparent"
                  onClick={() => handleRemoveDomain(domain)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </SettingsRow>
  )
}
