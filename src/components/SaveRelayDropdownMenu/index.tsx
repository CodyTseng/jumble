import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { normalizeUrl } from '@/lib/url'
import { useRelaySets } from '@/providers/RelaySetsProvider'
import { TRelaySet } from '@/types'
import { Check, FolderPlus, Plus, Star } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function SaveRelayDropdownMenu({
  urls,
  atTitlebar = false
}: {
  urls: string[]
  atTitlebar?: boolean
}) {
  const { t } = useTranslation()
  const { relaySets } = useRelaySets()
  const normalizedUrls = useMemo(() => urls.map((url) => normalizeUrl(url)), [urls])
  const alreadySaved = useMemo(
    () => relaySets.some((set) => normalizedUrls.every((url) => set.relayUrls.includes(url))),
    [relaySets, normalizedUrls]
  )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {atTitlebar ? (
          <Button variant="ghost" size="titlebar-icon">
            <Star className={alreadySaved ? 'fill-primary stroke-primary' : ''} />
          </Button>
        ) : (
          <button className="enabled:hover:text-primary [&_svg]:size-5">
            <Star className={alreadySaved ? 'fill-primary stroke-primary' : ''} />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{t('Save to')} ...</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {relaySets.map((set) => (
          <RelaySetItem key={set.id} set={set} urls={normalizedUrls} />
        ))}
        <DropdownMenuSeparator />
        <SaveToNewSet urls={normalizedUrls} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RelaySetItem({ set, urls }: { set: TRelaySet; urls: string[] }) {
  const { updateRelaySet } = useRelaySets()
  const saved = urls.every((url) => set.relayUrls.includes(url))

  const handleClick = () => {
    if (saved) {
      updateRelaySet({
        ...set,
        relayUrls: set.relayUrls.filter((u) => !urls.includes(u))
      })
    } else {
      updateRelaySet({
        ...set,
        relayUrls: Array.from(new Set([...set.relayUrls, ...urls]))
      })
    }
  }

  return (
    <DropdownMenuItem key={set.id} className="flex gap-2" onClick={handleClick}>
      {saved ? <Check /> : <Plus />}
      {set.name}
    </DropdownMenuItem>
  )
}

function SaveToNewSet({ urls }: { urls: string[] }) {
  const { t } = useTranslation()
  const { addRelaySet } = useRelaySets()

  const handleSave = () => {
    const newSetName = prompt(t('Enter a name for the new relay set'))
    if (newSetName) {
      addRelaySet(newSetName, urls)
    }
  }

  return (
    <DropdownMenuItem onClick={handleSave}>
      <FolderPlus />
      {t('Save to a new relay set')}
    </DropdownMenuItem>
  )
}
