import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { TRelaySet } from '@/types'
import { Check, ChevronDown, EllipsisVertical, FolderClosed } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelayUrls from './RelayUrl'
import { useRelaySetsSettingComponent } from './provider'

export default function RelaySet({ relaySet }: { relaySet: TRelaySet }) {
  const { t } = useTranslation()
  const { expandedRelaySetId } = useRelaySetsSettingComponent()

  return (
    <div className="w-full border rounded-lg p-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2 items-center">
          <FolderClosed className="size-4 shrink-0" />
          <RelaySetName relaySet={relaySet} />
        </div>
        <div className="flex gap-1">
          <RelayUrlsExpandToggle relaySetId={relaySet.id}>
            {t('n relays', { n: relaySet.relayUrls.length })}
          </RelayUrlsExpandToggle>
          <RelaySetOptions relaySet={relaySet} />
        </div>
      </div>
      {expandedRelaySetId === relaySet.id && <RelayUrls relaySetId={relaySet.id} />}
    </div>
  )
}

function RelaySetName({ relaySet }: { relaySet: TRelaySet }) {
  const [newSetName, setNewSetName] = useState(relaySet.name)
  const { updateRelaySet } = useFavoriteRelays()
  const { renamingRelaySetId, setRenamingRelaySetId } = useRelaySetsSettingComponent()

  const saveNewRelaySetName = () => {
    if (relaySet.name === newSetName) {
      return setRenamingRelaySetId(null)
    }
    updateRelaySet({ ...relaySet, name: newSetName })
    setRenamingRelaySetId(null)
  }

  const handleRenameInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewSetName(e.target.value)
  }

  const handleRenameInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      saveNewRelaySetName()
    }
  }

  return renamingRelaySetId === relaySet.id ? (
    <div className="flex gap-1 items-center">
      <Input
        value={newSetName}
        onChange={handleRenameInputChange}
        onBlur={saveNewRelaySetName}
        onKeyDown={handleRenameInputKeyDown}
        className="font-semibold w-28"
      />
      <Button variant="ghost" size="icon" onClick={saveNewRelaySetName}>
        <Check size={18} className="text-green-500" />
      </Button>
    </div>
  ) : (
    <div className="h-8 font-semibold flex items-center select-none">{relaySet.name}</div>
  )
}

function RelayUrlsExpandToggle({
  relaySetId,
  children
}: {
  relaySetId: string
  children: React.ReactNode
}) {
  const { expandedRelaySetId, setExpandedRelaySetId } = useRelaySetsSettingComponent()
  return (
    <div
      className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground"
      onClick={() => setExpandedRelaySetId((pre) => (pre === relaySetId ? null : relaySetId))}
    >
      <div className="select-none">{children}</div>
      <ChevronDown
        size={16}
        className={`transition-transform duration-200 ${expandedRelaySetId === relaySetId ? 'rotate-180' : ''}`}
      />
    </div>
  )
}

function RelaySetOptions({ relaySet }: { relaySet: TRelaySet }) {
  const { t } = useTranslation()
  const { deleteRelaySet } = useFavoriteRelays()
  const { setRenamingRelaySetId } = useRelaySetsSettingComponent()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setRenamingRelaySetId(relaySet.id)}>
          {t('Rename')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(
              `https://jumble.social/?${relaySet.relayUrls.map((url) => 'r=' + url).join('&')}`
            )
          }}
        >
          {t('Copy share link')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => deleteRelaySet(relaySet.id)}
        >
          {t('Delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
