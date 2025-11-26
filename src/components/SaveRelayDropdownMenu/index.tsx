import { Button } from '@/components/ui/button'
import {
  ResponsiveMenu,
  ResponsiveMenuContent,
  ResponsiveMenuItem,
  ResponsiveMenuLabel,
  ResponsiveMenuSeparator,
  ResponsiveMenuTrigger
} from '@/components/ui/responsive-menu'
import { normalizeUrl } from '@/lib/url'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useNostr } from '@/providers/NostrProvider'
import { TRelaySet } from '@/types'
import { Check, FolderPlus, Plus, Star } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export default function SaveRelayDropdownMenu({
  urls,
  bigButton = false
}: {
  urls: string[]
  bigButton?: boolean
}) {
  const { t } = useTranslation()
  const { favoriteRelays, relaySets } = useFavoriteRelays()
  const normalizedUrls = useMemo(() => urls.map((url) => normalizeUrl(url)).filter(Boolean), [urls])
  const alreadySaved = useMemo(() => {
    return (
      normalizedUrls.every((url) => favoriteRelays.includes(url)) ||
      relaySets.some((set) => normalizedUrls.every((url) => set.relayUrls.includes(url)))
    )
  }, [relaySets, normalizedUrls, favoriteRelays])

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <ResponsiveMenu>
        <ResponsiveMenuTrigger asChild>
          {bigButton ? (
            <Button variant="ghost" size="titlebar-icon">
              <Star className={alreadySaved ? 'fill-primary stroke-primary' : ''} />
            </Button>
          ) : (
            <button className="enabled:hover:text-primary [&_svg]:size-5 pr-0 pt-0.5">
              <Star className={alreadySaved ? 'fill-primary stroke-primary' : ''} />
            </button>
          )}
        </ResponsiveMenuTrigger>
        <ResponsiveMenuContent>
          <ResponsiveMenuLabel>{t('Save to')} ...</ResponsiveMenuLabel>
          <ResponsiveMenuSeparator />
          <RelayItem urls={normalizedUrls} />
          {relaySets.map((set) => (
            <RelaySetItem key={set.id} set={set} urls={normalizedUrls} />
          ))}
          <ResponsiveMenuSeparator />
          <SaveToNewSet urls={normalizedUrls} />
        </ResponsiveMenuContent>
      </ResponsiveMenu>
    </div>
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
    <ResponsiveMenuItem onClick={handleClick}>
      {saved ? <Check /> : <Plus />}
      {saved ? t('Unfavorite') : t('Favorite')}
    </ResponsiveMenuItem>
  )
}

function RelaySetItem({ set, urls }: { set: TRelaySet; urls: string[] }) {
  const { pubkey, startLogin } = useNostr()
  const { updateRelaySet } = useFavoriteRelays()
  const saved = urls.every((url) => set.relayUrls.includes(url))

  const handleClick = () => {
    if (!pubkey) {
      startLogin()
      return
    }
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
    <ResponsiveMenuItem onClick={handleClick}>
      {saved ? <Check /> : <Plus />}
      {set.name}
    </ResponsiveMenuItem>
  )
}

function SaveToNewSet({ urls }: { urls: string[] }) {
  const { t } = useTranslation()
  const { pubkey, startLogin } = useNostr()
  const { createRelaySet } = useFavoriteRelays()

  const handleSave = () => {
    if (!pubkey) {
      startLogin()
      return
    }
    const newSetName = prompt(t('Enter a name for the new relay set'))
    if (newSetName) {
      createRelaySet(newSetName, urls)
    }
  }

  return (
    <ResponsiveMenuItem onClick={handleSave}>
      <FolderPlus />
      {t('Save to a new relay set')}
    </ResponsiveMenuItem>
  )
}
