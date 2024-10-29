import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Check, ChevronDown, Circle, CircleCheck, EllipsisVertical, X } from 'lucide-react'
import { useState } from 'react'
import { Input } from '../ui/input'
import { Separator } from '../ui/separator'

type TRelayGroup = {
  groupName: string
  relayUrls: string[]
  isActive: boolean
}

const relayGroups: TRelayGroup[] = [
  {
    groupName: 'Default',
    relayUrls: ['wss://relay.zksync.io', 'wss://relay.zkscan.io'],
    isActive: true
  },
  {
    groupName: 'Test',
    relayUrls: ['wss://relay.zksync.io', 'wss://relay.zkscan.io'],
    isActive: false
  }
]

export default function RelaySettings() {
  const [groups, setGroups] = useState<TRelayGroup[]>(relayGroups)
  const [newGroupName, setNewGroupName] = useState('')
  const [newNameError, setNewNameError] = useState<string | null>(null)

  const switchRelayGroup = (groupName: string) => {
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        isActive: group.groupName === groupName
      }))
    )
  }

  const deleteRelayGroup = (groupName: string) => {
    setGroups((prev) => prev.filter((group) => group.groupName !== groupName || group.isActive))
  }

  const updateRelayGroupRelayUrls = (groupName: string, relayUrls: string[]) => {
    const newRelayUrls = Array.from(
      new Set(relayUrls.map((url) => url.trim()).filter((url) => url !== ''))
    )
    for (const url of newRelayUrls) {
      if (/^wss?:\/\/.+$/.test(url) === false) {
        return 'invalid URL'
      }
    }
    setGroups((prev) =>
      prev.map((group) => ({
        ...group,
        relayUrls: group.groupName === groupName ? newRelayUrls : group.relayUrls
      }))
    )
    return null
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
    setGroups((prev) =>
      prev.map((group) => ({
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
    setGroups((prev) => [
      ...prev,
      {
        groupName: newGroupName,
        relayUrls: [],
        isActive: false
      }
    ])
    setNewGroupName('')
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

function RelayGroup({
  group,
  onSwitch,
  onDelete,
  onRename,
  onRelayUrlsUpdate
}: {
  group: TRelayGroup
  onSwitch: (groupName: string) => void
  onDelete: (groupName: string) => void
  onRename: (oldGroupName: string, newGroupName: string) => string | null
  onRelayUrlsUpdate: (groupName: string, relayUrls: string[]) => string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newGroupName, setNewGroupName] = useState(group.groupName)
  const [newNameError, setNewNameError] = useState<string | null>(null)
  const [newRelayUrl, setNewRelayUrl] = useState('')
  const [newRelayUrlError, setNewRelayUrlError] = useState<string | null>(null)

  const toggleExpanded = () => setExpanded((prev) => !prev)

  const handleRenameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewGroupName(e.target.value)
    setNewNameError(null)
  }

  const handleRenameInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveNewGroupName()
    }
  }

  const handleRelayUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewRelayUrl(e.target.value)
    setNewRelayUrlError(null)
  }

  const handleRelayUrlInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveNewRelayUrl()
    }
  }

  const saveNewGroupName = () => {
    const errMsg = onRename(group.groupName, newGroupName)
    if (errMsg) {
      setNewNameError(errMsg)
      return
    }
    setRenaming(false)
  }

  const removeRelayUrl = (url: string) => {
    onRelayUrlsUpdate(
      group.groupName,
      group.relayUrls.filter((u) => u !== url)
    )
  }

  const saveNewRelayUrl = () => {
    const errMsg = onRelayUrlsUpdate(group.groupName, [...group.relayUrls, newRelayUrl])
    if (errMsg) {
      setNewRelayUrlError(errMsg)
      return
    }
    setNewRelayUrl('')
  }

  return (
    <div
      className={`w-full border rounded-lg p-4 ${group.isActive ? 'border-highlight bg-highlight/5' : ''}`}
    >
      <div className="flex justify-between items-center">
        <div className="flex space-x-2 items-center">
          {group.isActive ? (
            <CircleCheck size={18} className="text-highlight shrink-0" />
          ) : (
            <Circle
              size={18}
              className="text-muted-foreground cursor-pointer hover:text-foreground shrink-0"
              onClick={() => onSwitch(group.groupName)}
            />
          )}
          {renaming ? (
            <div className="flex gap-1 items-center">
              <Input
                value={newGroupName}
                onChange={handleRenameInputChange}
                onBlur={saveNewGroupName}
                onKeyDown={handleRenameInputKeyDown}
                className={`font-semibold w-24 h-8 ${group.isActive ? 'focus-visible:ring-highlight' : ''} ${newNameError ? 'border-destructive' : ''}`}
              />
              <Button
                variant="ghost"
                className={`h-8 w-8 ${group.isActive ? 'hover:bg-highlight/20' : ''}`}
                onClick={saveNewGroupName}
              >
                <Check size={18} />
              </Button>
              {newNameError && <div className="text-xs text-destructive">{newNameError}</div>}
            </div>
          ) : (
            <div className="h-8 font-semibold flex items-center">{group.groupName}</div>
          )}
        </div>
        <div className="flex gap-1">
          <div
            className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground"
            onClick={toggleExpanded}
          >
            <div className="select-none">{group.relayUrls.length} relays</div>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
          </div>
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button size="xs" variant="ghost" className="text-muted-foreground">
                  <EllipsisVertical size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  disabled={group.isActive}
                  onClick={() => onDelete(group.groupName)}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      {expanded && (
        <>
          <div className="mt-1">
            {group.relayUrls.map((url) => (
              <RelayUrl key={url} url={url} onRemove={() => removeRelayUrl(url)} />
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input
              className={`h-8 ${group.isActive ? 'focus-visible:ring-highlight' : ''} ${newRelayUrlError ? 'border-destructive' : ''}`}
              placeholder="Add new relay URL"
              value={newRelayUrl}
              onKeyDown={handleRelayUrlInputKeyDown}
              onChange={handleRelayUrlInputChange}
              onBlur={saveNewRelayUrl}
            />
            <Button
              className={`h-8 w-12 ${group.isActive ? 'bg-highlight hover:bg-highlight/90 text-foreground' : ''}`}
              onClick={saveNewRelayUrl}
            >
              Add
            </Button>
          </div>
          {newRelayUrlError && (
            <div className="text-xs text-destructive mt-1">{newRelayUrlError}</div>
          )}
        </>
      )}
    </div>
  )
}

function RelayUrl({ url, onRemove }: { url: string; onRemove: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-muted-foreground text-sm">{url}</div>
      <div>
        <Button
          size="xs"
          variant="ghost"
          className="text-xs text-destructive hover:bg-destructive/90 hover:text-background"
          onClick={onRemove}
        >
          <X size={12} />
        </Button>
      </div>
    </div>
  )
}
