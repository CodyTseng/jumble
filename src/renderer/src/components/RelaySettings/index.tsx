import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Separator } from '@renderer/components/ui/separator'
import storage from '@renderer/services/storage.service'
import { useEffect, useRef, useState } from 'react'
import RelayGroup from './RelayGroup'
import { TRelayGroup } from './types'

export default function RelaySettings() {
  const [groups, setGroups] = useState<TRelayGroup[]>([])
  const [newGroupName, setNewGroupName] = useState('')
  const [newNameError, setNewNameError] = useState<string | null>(null)
  const dummyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const init = async () => {
      const storedGroups = await storage.getRelayGroups()
      setGroups(storedGroups)
    }

    if (dummyRef.current) {
      dummyRef.current.focus()
    }
    init()
  }, [])

  const updateGroups = async (newGroups: TRelayGroup[]) => {
    setGroups(newGroups)
    await storage.setRelayGroups(newGroups)
  }

  const switchRelayGroup = (groupName: string) => {
    updateGroups(
      groups.map((group) => ({
        ...group,
        isActive: group.groupName === groupName
      }))
    )
  }

  const deleteRelayGroup = (groupName: string) => {
    updateGroups(groups.filter((group) => group.groupName !== groupName || group.isActive))
  }

  const updateRelayGroupRelayUrls = (groupName: string, relayUrls: string[]) => {
    updateGroups(
      groups.map((group) => ({
        ...group,
        relayUrls: group.groupName === groupName ? relayUrls : group.relayUrls
      }))
    )
  }

  const renameRelayGroup = (oldGroupName: string, newGroupName: string) => {
    if (newGroupName === '') {
      return null
    }
    if (oldGroupName === newGroupName) {
      return null
    }
    if (groups.some((group) => group.groupName === newGroupName)) {
      return 'already exists'
    }
    updateGroups(
      groups.map((group) => ({
        ...group,
        groupName: group.groupName === oldGroupName ? newGroupName : group.groupName
      }))
    )
    return null
  }

  const addRelayGroup = () => {
    if (newGroupName === '') {
      return
    }
    if (groups.some((group) => group.groupName === newGroupName)) {
      return setNewNameError('already exists')
    }
    setNewGroupName('')
    updateGroups([
      ...groups,
      {
        groupName: newGroupName,
        relayUrls: [],
        isActive: false
      }
    ])
  }

  const handleNewGroupNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewGroupName(e.target.value)
    setNewNameError(null)
  }

  const handleNewGroupNameKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      addRelayGroup()
    }
  }

  return (
    <div>
      <div ref={dummyRef} tabIndex={-1} style={{ position: 'absolute', opacity: 0 }}></div>
      <div className="text-lg font-semibold mb-4">Relay Settings</div>
      <div className="space-y-2">
        {groups.map((group, index) => (
          <RelayGroup
            key={index}
            group={group}
            onSwitch={switchRelayGroup}
            onDelete={deleteRelayGroup}
            onRename={renameRelayGroup}
            onRelayUrlsUpdate={updateRelayGroupRelayUrls}
          />
        ))}
      </div>
      {groups.length < 5 && (
        <>
          <Separator className="my-4" />
          <div className="w-full border rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div className="font-semibold">Add a new relay group</div>
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                className={`h-8 ${newNameError ? 'border-destructive' : ''}`}
                placeholder="Group name"
                value={newGroupName}
                onChange={handleNewGroupNameChange}
                onKeyDown={handleNewGroupNameKeyDown}
                onBlur={addRelayGroup}
              />
              <Button className="h-8 w-12">Add</Button>
            </div>
            {newNameError && <div className="text-xs text-destructive mt-1">{newNameError}</div>}
          </div>
        </>
      )}
    </div>
  )
}
