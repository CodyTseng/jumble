import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Separator } from '@renderer/components/ui/separator'
import { useRelaySettings } from '@renderer/providers/RelaySettingsProvider'
import { useEffect, useRef, useState } from 'react'
import { RelaySettingsComponentProvider } from './provider'
import RelayGroup from './RelayGroup'

export default function RelaySettings() {
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
      <div className="text-lg font-semibold mb-4">Relay Settings</div>
      <div className="space-y-2">
        {relayGroups.map((group, index) => (
          <RelayGroup key={index} group={group} />
        ))}
      </div>
      {relayGroups.length < 5 && (
        <>
          <Separator className="my-4" />
          <div className="w-full border rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">Add a new relay group</div>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                className={newNameError ? 'border-destructive' : ''}
                placeholder="Group name"
                value={newGroupName}
                onChange={handleNewGroupNameChange}
                onKeyDown={handleNewGroupNameKeyDown}
                onBlur={saveRelayGroup}
              />
              <Button>Add</Button>
            </div>
            {newNameError && <div className="text-xs text-destructive mt-1">{newNameError}</div>}
          </div>
        </>
      )}
    </RelaySettingsComponentProvider>
  )
}
