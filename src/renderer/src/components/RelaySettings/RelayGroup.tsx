import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { Input } from '@renderer/components/ui/input'
import { Check, ChevronDown, Circle, CircleCheck, EllipsisVertical } from 'lucide-react'
import { useState } from 'react'
import { TRelayGroup } from './types'
import RelayUrls from './RelayUrl'

export default function RelayGroup({
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
  onRelayUrlsUpdate: (groupName: string, relayUrls: string[]) => void
}) {
  const { groupName, isActive, relayUrls } = group
  const [expanded, setExpanded] = useState(false)
  const [renaming, setRenaming] = useState(false)

  const toggleExpanded = () => setExpanded((prev) => !prev)

  return (
    <div
      className={`w-full border rounded-lg p-4 ${isActive ? 'border-highlight bg-highlight/5' : ''}`}
    >
      <div className="flex justify-between items-center">
        <div className="flex space-x-2 items-center">
          <RelayGroupActiveToggle
            isActive={isActive}
            onToggle={() => onSwitch(groupName)}
            hasRelayUrls={relayUrls.length > 0}
          />
          <RelayGroupName
            groupName={groupName}
            renaming={renaming}
            hasRelayUrls={relayUrls.length > 0}
            setRenaming={setRenaming}
            save={onRename}
            onToggle={() => onSwitch(groupName)}
          />
        </div>
        <div className="flex gap-1">
          <RelayUrlsExpandToggle expanded={expanded} onClick={toggleExpanded}>
            {relayUrls.length} relays
          </RelayUrlsExpandToggle>
          <RelayGroupOptions
            groupName={groupName}
            isActive={isActive}
            onDelete={onDelete}
            setRenaming={setRenaming}
          />
        </div>
      </div>
      {expanded && (
        <RelayUrls
          isActive={isActive}
          relayUrls={relayUrls}
          update={(urls) => onRelayUrlsUpdate(groupName, urls)}
        />
      )}
    </div>
  )
}

function RelayGroupActiveToggle({
  isActive,
  hasRelayUrls,
  onToggle
}: {
  isActive: boolean
  hasRelayUrls: boolean
  onToggle: () => void
}) {
  return (
    <>
      {isActive ? (
        <CircleCheck size={18} className="text-highlight shrink-0" />
      ) : (
        <Circle
          size={18}
          className={`text-muted-foreground shrink-0 ${hasRelayUrls ? 'cursor-pointer hover:text-foreground ' : ''}`}
          onClick={() => {
            if (hasRelayUrls) {
              onToggle()
            }
          }}
        />
      )}
    </>
  )
}

function RelayGroupName({
  groupName,
  renaming,
  hasRelayUrls,
  setRenaming,
  save,
  onToggle
}: {
  groupName: string
  renaming: boolean
  hasRelayUrls: boolean
  setRenaming: (renaming: boolean) => void
  save: (oldGroupName: string, newGroupName: string) => string | null
  onToggle: () => void
}) {
  const [newGroupName, setNewGroupName] = useState(groupName)
  const [newNameError, setNewNameError] = useState<string | null>(null)

  const saveNewGroupName = () => {
    const errMsg = save(groupName, newGroupName)
    if (errMsg) {
      setNewNameError(errMsg)
      return
    }
    setRenaming(false)
  }

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

  return (
    <>
      {renaming ? (
        <div className="flex gap-1 items-center">
          <Input
            value={newGroupName}
            onChange={handleRenameInputChange}
            onBlur={saveNewGroupName}
            onKeyDown={handleRenameInputKeyDown}
            className={`font-semibold w-24 h-8 ${newNameError ? 'border-destructive' : ''}`}
          />
          <Button variant="ghost" className="h-8 w-8" onClick={saveNewGroupName}>
            <Check size={18} className="text-green-500" />
          </Button>
          {newNameError && <div className="text-xs text-destructive">{newNameError}</div>}
        </div>
      ) : (
        <div
          className={`h-8 font-semibold flex items-center ${hasRelayUrls ? 'cursor-pointer' : 'text-muted-foreground'}`}
          onClick={() => {
            if (hasRelayUrls) {
              onToggle()
            }
          }}
        >
          {groupName}
        </div>
      )}
    </>
  )
}

function RelayUrlsExpandToggle({
  expanded,
  onClick,
  children
}: {
  expanded: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground"
      onClick={onClick}
    >
      <div className="select-none">{children}</div>
      <ChevronDown
        size={16}
        className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      />
    </div>
  )
}

function RelayGroupOptions({
  groupName,
  isActive,
  onDelete,
  setRenaming
}: {
  groupName: string
  isActive: boolean
  onDelete: (groupName: string) => void
  setRenaming: (renaming: boolean) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <EllipsisVertical
          size={16}
          className="text-muted-foreground hover:text-accent-foreground cursor-pointer"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setRenaming(true)}>Rename</DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          disabled={isActive}
          onClick={() => onDelete(groupName)}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
