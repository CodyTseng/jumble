import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Modal, ModalContent, ModalTrigger } from '@/components/ui/modal'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { TRelaySet } from '@/types'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Check,
  ChevronDown,
  Edit,
  EllipsisVertical,
  FolderClosed,
  GripVertical,
  Link,
  Trash2
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DrawerMenuItem from '../DrawerMenuItem'
import RelayUrls from './RelayUrl'
import { useRelaySetsSettingComponent } from './provider'

export default function RelaySet({ relaySet }: { relaySet: TRelaySet }) {
  const { t } = useTranslation()
  const { expandedRelaySetId } = useRelaySetsSettingComponent()
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: relaySet.id
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  }

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div className="w-full rounded-lg border px-2 py-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              className="hover:bg-muted cursor-grab touch-none rounded p-2 active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="text-muted-foreground size-4" />
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <FolderClosed className="size-4" />
              </div>
              <RelaySetName relaySet={relaySet} />
            </div>
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
    <div className="flex items-center gap-1">
      <Input
        value={newSetName}
        onChange={handleRenameInputChange}
        onBlur={saveNewRelaySetName}
        onKeyDown={handleRenameInputKeyDown}
        className="w-28 font-semibold"
      />
      <Button variant="ghost" size="icon" onClick={saveNewRelaySetName}>
        <Check size={18} className="text-green-500" />
      </Button>
    </div>
  ) : (
    <div className="flex h-8 items-center font-semibold select-none">{relaySet.name}</div>
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
      className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-sm"
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
  const { isSmallScreen } = useScreenSize()
  const { deleteRelaySet } = useFavoriteRelays()
  const { setRenamingRelaySetId } = useRelaySetsSettingComponent()

  const trigger = (
    <Button variant="ghost" size="icon">
      <EllipsisVertical />
    </Button>
  )

  const rename = () => {
    setRenamingRelaySetId(relaySet.id)
  }

  const copyShareLink = () => {
    navigator.clipboard.writeText(
      `https://jumble.social/?${relaySet.relayUrls.map((url) => 'r=' + url).join('&')}`
    )
  }

  if (isSmallScreen) {
    return (
      <Modal>
        <ModalTrigger asChild>{trigger}</ModalTrigger>
        <ModalContent>
          <div className="py-2">
            <DrawerMenuItem onClick={rename}>
              <Edit />
              {t('Rename')}
            </DrawerMenuItem>
            <DrawerMenuItem onClick={copyShareLink}>
              <Link />
              {t('Copy share link')}
            </DrawerMenuItem>
            <DrawerMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => deleteRelaySet(relaySet.id)}
            >
              <Trash2 />
              {t('Delete')}
            </DrawerMenuItem>
          </div>
        </ModalContent>
      </Modal>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={rename}>
          <Edit />
          {t('Rename')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={copyShareLink}>
          <Link />
          {t('Copy share link')}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() => deleteRelaySet(relaySet.id)}
        >
          <Trash2 />
          {t('Delete')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
