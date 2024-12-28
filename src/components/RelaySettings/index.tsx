import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useRelaySettings } from '@/providers/RelaySettingsProvider'
import { useEffect, useRef, useState } from 'react'
import { RelaySettingsComponentProvider } from './provider'
import RelayGroup from './RelayGroup'
import TemporaryRelayGroup from './TemporaryRelayGroup'
import { useTranslation } from 'react-i18next'

export default function RelaySettings({ hideTitle = false }: { hideTitle?: boolean }) {
  const { t } = useTranslation()
  const { relayGroups, addRelayGroup } = useRelaySettings()
  const [newGroupName, setNewGroupName] = useState('')
  const [newNameError, setNewNameError] = useState<string | null>(null)
  const dummyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (dummyRef.current) {
      dummyRef.current.focus()
    }
  }, [])

  const saveRelayGroup = () => {
    if (relayGroups.find((group) => group.groupName === newGroupName)) {
      return setNewNameError(t('relay collection name already exists'))
    }
    const errMsg = addRelayGroup(newGroupName)
    if (errMsg) {
      return setNewNameError(errMsg)
    }
    setNewGroupName('')
  }

  const handleNewGroupNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewGroupName(e.target.value)
    setNewNameError(null)
  }

  const handleNewGroupNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveRelayGroup()
    }
  }

  return (
    <RelaySettingsComponentProvider>
      <div ref={dummyRef} tabIndex={-1} style={{ position: 'absolute', opacity: 0 }}></div>
      {!hideTitle && <div className="text-lg font-semibold mb-4">{t('Relay Settings')}</div>}
      <div className="space-y-2">
        <TemporaryRelayGroup />
        {relayGroups.map((group, index) => (
          <RelayGroup key={index} group={group} />
        ))}
      </div>
      {relayGroups.length < 10 && (
        <>
          <Separator className="my-4" />
          <div className="w-full border rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">{t('Add a new relay collection')}</div>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                className={newNameError ? 'border-destructive' : ''}
                placeholder={t('Relay collection name')}
                value={newGroupName}
                onChange={handleNewGroupNameChange}
                onKeyDown={handleNewGroupNameKeyDown}
                onBlur={saveRelayGroup}
              />
              <Button onClick={saveRelayGroup}>{t('Add')}</Button>
            </div>
            {newNameError && <div className="text-xs text-destructive mt-1">{newNameError}</div>}
          </div>
        </>
      )}
    </RelaySettingsComponentProvider>
  )
}
