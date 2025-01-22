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
import { toProfile } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import client from '@/services/client.service'
import { TMailboxRelay } from '@/types'
import { ChevronDown, Circle, CircleCheck, ScanSearch } from 'lucide-react'
import { Dispatch, SetStateAction, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import RelayIcon from '../RelayIcon'
import { SimpleUserAvatar } from '../UserAvatar'
import { SimpleUsername } from '../Username'

export default function CalculateOptimalReadRelaysButton({
  mergeRelays
}: {
  mergeRelays: (newRelays: TMailboxRelay[]) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { pubkey } = useNostr()
  const [open, setOpen] = useState(false)

  const trigger = (
    <Button variant="secondary" className="w-full" disabled={!pubkey}>
      <ScanSearch />
      {t('Calculate optimal read relays')}
    </Button>
  )

  if (isSmallScreen) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="max-h-[90vh]">
          <div className="flex flex-col p-4 gap-4 overflow-auto">
            <DrawerHeader>
              <DrawerTitle>{t('Select relays to append')}</DrawerTitle>
              <DrawerDescription className="hidden" />
            </DrawerHeader>
            <OptimalReadRelays close={() => setOpen(false)} mergeRelays={mergeRelays} />
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
          <DialogTitle>{t('Select relays to append')}</DialogTitle>
          <DialogDescription className="hidden" />
        </DialogHeader>
        <OptimalReadRelays close={() => setOpen(false)} mergeRelays={mergeRelays} />
      </DialogContent>
    </Dialog>
  )
}

function OptimalReadRelays({
  close,
  mergeRelays
}: {
  close: () => void
  mergeRelays: (newRelays: TMailboxRelay[]) => void
}) {
  const { t } = useTranslation()
  const { pubkey } = useNostr()
  const [isCalculating, setIsCalculating] = useState(false)
  const [optimalReadRelays, setOptimalReadRelays] = useState<{ url: string; pubkeys: string[] }[]>(
    []
  )
  const [selectedRelayUrls, setSelectedRelayUrls] = useState<string[]>([])

  useEffect(() => {
    if (!pubkey) return

    const init = async () => {
      setIsCalculating(true)
      const relays = await client.calculateOptimalReadRelays(pubkey)
      console.log(relays)
      setOptimalReadRelays(relays)
      setIsCalculating(false)
    }
    init()
  }, [])

  if (isCalculating) {
    return <div className="text-center text-sm text-muted-foreground">{t('calculating...')}</div>
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {optimalReadRelays.map((relay) => (
          <RelayItem
            key={relay.url}
            relay={relay}
            close={close}
            selectedRelayUrls={selectedRelayUrls}
            setSelectedRelayUrls={setSelectedRelayUrls}
          />
        ))}
      </div>
      <Button
        disabled={selectedRelayUrls.length === 0}
        className="w-full"
        onClick={() => {
          mergeRelays(
            selectedRelayUrls.map((url) => ({
              url,
              scope: 'read'
            }))
          )
          close()
        }}
      >
        {selectedRelayUrls.length === 0
          ? t('Append')
          : t('Append n relays', { n: selectedRelayUrls.length })}
      </Button>
    </div>
  )
}

function RelayItem({
  relay,
  close,
  selectedRelayUrls,
  setSelectedRelayUrls
}: {
  relay: { url: string; pubkeys: string[] }
  close: () => void
  selectedRelayUrls: string[]
  setSelectedRelayUrls: Dispatch<SetStateAction<string[]>>
}) {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const [expanded, setExpanded] = useState(false)

  const selected = selectedRelayUrls.includes(relay.url)

  return (
    <div
      className={`rounded-lg p-4 border select-none cursor-pointer ${selected ? 'border-highlight bg-highlight/5' : ''}`}
      onClick={() =>
        setSelectedRelayUrls((pre) =>
          pre.includes(relay.url) ? pre.filter((url) => url !== relay.url) : [...pre, relay.url]
        )
      }
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 w-0">
          <SelectToggle
            select={selectedRelayUrls.includes(relay.url)}
            setSelect={(select) => {
              setSelectedRelayUrls((prev) =>
                select ? [...prev, relay.url] : prev.filter((url) => url !== relay.url)
              )
            }}
          />
          <RelayIcon url={relay.url} className="h-8 w-8" />
          <div className="font-semibold truncate text-lg">{relay.url}</div>
        </div>
        <div
          className="flex items-center cursor-pointer gap-1 text-muted-foreground hover:text-foreground text-sm"
          onClick={(e) => {
            e.stopPropagation()
            setExpanded((prev) => !prev)
          }}
        >
          <div>
            {relay.pubkeys.length} {t('followings')}
          </div>
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </div>
      {expanded && (
        <div className="space-y-2 pt-2 pl-7">
          {relay.pubkeys.map((pubkey) => (
            <div
              key={pubkey}
              className="flex cursor-pointer items-center gap-2"
              onClick={(e) => {
                e.stopPropagation()
                close()
                push(toProfile(pubkey))
              }}
            >
              <SimpleUserAvatar userId={pubkey} size="small" />
              <SimpleUsername userId={pubkey} className="font-semibold truncate" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SelectToggle({
  select,
  setSelect
}: {
  select: boolean
  setSelect: (select: boolean) => void
}) {
  return select ? (
    <CircleCheck
      size={18}
      className="text-highlight shrink-0 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation()
        setSelect(false)
      }}
    />
  ) : (
    <Circle
      size={18}
      className="shrink-0 cursor-pointer"
      onClick={(e) => {
        e.stopPropagation()
        setSelect(true)
      }}
    />
  )
}
