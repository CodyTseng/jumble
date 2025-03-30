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
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
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
  const { favoriteRelays, relaySets } = useFavoriteRelays()
  const normalizedUrls = useMemo(() => urls.map((url) => normalizeUrl(url)).filter(Boolean), [urls])
  const alreadySaved = useMemo(() => {
    return (
      normalizedUrls.every((url) => favoriteRelays.includes(url)) ||
      relaySets.some((set) => normalizedUrls.every((url) => set.relayUrls.includes(url)))
    )
  }, [relaySets, normalizedUrls])

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
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuLabel>{t('Save to')} ...</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <RelayItem urls={normalizedUrls} />
        {relaySets.map((set) => (
          <RelaySetItem key={set.id} set={set} urls={normalizedUrls} />
        ))}
        <DropdownMenuSeparator />
        <SaveToNewSet urls={normalizedUrls} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function RelayItem({ urls }: { urls: string[] }) {
  const { t } = useTranslation()
  const { favoriteRelays, addFavoriteRelays, deleteFavoriteRelays } = useFavoriteRelays()
  const saved = useMemo(
    () => urls.every((url) => favoriteRelays.includes(url)),
    [favoriteRelays, urls]
  )

  const handleClick = async () => {
    if (saved) {
      await deleteFavoriteRelays(urls)
    } else {
      await addFavoriteRelays(urls)
    }
  }

  return (
    <DropdownMenuItem className="flex gap-2" onClick={handleClick}>
      {saved ? <Check /> : <Plus />}
      {t('Favorite')}
    </DropdownMenuItem>
  )
}

function RelaySetItem({ set, urls }: { set: TRelaySet; urls: string[] }) {
  const { updateRelaySet } = useFavoriteRelays()
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
  const { addRelaySet } = useFavoriteRelays()

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
