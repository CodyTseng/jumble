import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger
} from '@/components/ui/drawer'
import { BIG_RELAY_URLS } from '@/constants'
import { getReplaceableEventIdentifier } from '@/lib/event'
import { tagNameEquals } from '@/lib/tag'
import { isWebsocketUrl, simplifyUrl } from '@/lib/url'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import { TRelaySet } from '@/types'
import { CloudDownload } from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelaySetCard from '../RelaySetCard'
import { buildATag } from '@/lib/draft-event'

export default function PullRelaySetsButton() {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)

  const trigger = (
    <Button
      variant="link"
      className="text-muted-foreground hover:no-underline hover:text-foreground p-0 h-fit"
      disabled={!pubkey}
    >
      <CloudDownload />
      {t('Pull relay sets')}
    </Button>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[90vh]">
          <div className="flex flex-col p-4 gap-4 overflow-auto">
            <DrawerHeader>
              <DrawerTitle>{t('Select the relay sets you want to pull')}</DrawerTitle>
              <DrawerDescription className="hidden" />
            </DrawerHeader>
            <RemoteRelaySets close={() => setOpen(false)} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t('Select the relay sets you want to pull')}</DialogTitle>
          <DialogDescription className="hidden" />
        </DialogHeader>
        <RemoteRelaySets close={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function RemoteRelaySets({ close }: { close?: () => void }) {
  const { t } = useTranslation()
  const { pubkey, relayList } = useNostr()
  const { addRelaySets, relaySets: existingRelaySets } = useFavoriteRelays()
  const [initialed, setInitialed] = useState(false)
  const [relaySetEventMap, setRelaySetEventMap] = useState<Map<string, Event>>(new Map())
  const [relaySets, setRelaySets] = useState<TRelaySet[]>([])
  const [selectedRelaySetIds, setSelectedRelaySetIds] = useState<string[]>([])

  useEffect(() => {
    if (!pubkey) return

    const init = async () => {
      setInitialed(false)
      const events = await client.fetchEvents(
        (relayList?.write ?? []).concat(BIG_RELAY_URLS).slice(0, 4),
        {
          kinds: [kinds.Relaysets],
          authors: [pubkey],
          limit: 50
        }
      )
      events.sort((a, b) => b.created_at - a.created_at)

      const relaySetIds = new Set<string>(existingRelaySets.map((r) => r.id))
      const relaySets: TRelaySet[] = []
      const relaySetEventMap = new Map<string, Event>()
      events.forEach((evt) => {
        const id = getReplaceableEventIdentifier(evt)
        if (!id || relaySetIds.has(id)) return

        relaySetIds.add(id)
        const relayUrls = evt.tags
          .filter(tagNameEquals('relay'))
          .map((tag) => tag[1])
          .filter((url) => url && isWebsocketUrl(url))
        if (!relayUrls.length) return

        let title = evt.tags.find(tagNameEquals('title'))?.[1]
        if (!title) {
          title = relayUrls.length === 1 ? simplifyUrl(relayUrls[0]) : id
        }
        relaySets.push({ id, name: title, relayUrls, aTag: buildATag(evt) })
        relaySetEventMap.set(id, evt)
      })

      setRelaySets(relaySets)
      setRelaySetEventMap(relaySetEventMap)
      setInitialed(true)
    }
    init()
  }, [pubkey])

  if (!pubkey) return null
  if (!initialed) return <div className="text-center text-muted-foreground">{t('loading...')}</div>
  if (!relaySets.length) {
    return <div className="text-center text-muted-foreground">{t('No relay sets found')}</div>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {relaySets.map((relaySet) => (
          <RelaySetCard
            key={relaySet.id}
            relaySet={relaySet}
            select={selectedRelaySetIds.includes(relaySet.id)}
            onSelectChange={(select) => {
              if (select) {
                setSelectedRelaySetIds([...selectedRelaySetIds, relaySet.id])
              } else {
                setSelectedRelaySetIds(selectedRelaySetIds.filter((id) => id !== relaySet.id))
              }
            }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          className="w-20 shrink-0"
          variant="secondary"
          onClick={() => setSelectedRelaySetIds(relaySets.map((r) => r.id))}
        >
          {t('Select all')}
        </Button>
        <Button
          className="w-full"
          disabled={!selectedRelaySetIds.length}
          onClick={() => {
            const selectedRelaySets = selectedRelaySetIds
              .map((id) => relaySetEventMap.get(id))
              .filter(Boolean) as Event[]
            if (selectedRelaySets.length > 0) {
              addRelaySets(selectedRelaySets)
              close?.()
            }
          }}
        >
          {selectedRelaySetIds.length > 0
            ? t('Pull n relay sets', { n: selectedRelaySetIds.length })
            : t('Pull')}
        </Button>
      </div>
    </div>
  )
}
