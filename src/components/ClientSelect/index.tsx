import { Button, ButtonProps } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Drawer, DrawerContent, DrawerOverlay, DrawerTrigger } from '@/components/ui/drawer'
import { Separator } from '@/components/ui/separator'
import { ExtendedKind } from '@/constants'
import { getReplaceableEventIdentifier, getNoteBech32Id } from '@/lib/event'
import { toChachiChat } from '@/lib/link'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import clientService from '@/services/client.service'
import { ExternalLink } from 'lucide-react'
import { Event, kinds, nip19 } from 'nostr-tools'
import { Dispatch, SetStateAction, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const clients: Record<string, { name: string; getUrl: (id: string) => string }> = {
  nosta: {
    name: 'Nosta',
    getUrl: (id: string) => `https://nosta.me/${id}`
  },
  snort: {
    name: 'Snort',
    getUrl: (id: string) => `https://snort.social/${id}`
  },
  olas: {
    name: 'Olas',
    getUrl: (id: string) => `https://olas.app/e/${id}`
  },
  primal: {
    name: 'Primal',
    getUrl: (id: string) => `https://primal.net/e/${id}`
  },
  nostrudel: {
    name: 'Nostrudel',
    getUrl: (id: string) => `https://nostrudel.ninja/l/${id}`
  },
  nostter: {
    name: 'Nostter',
    getUrl: (id: string) => `https://nostter.app/${id}`
  },
  coracle: {
    name: 'Coracle',
    getUrl: (id: string) => `https://coracle.social/${id}`
  },
  iris: {
    name: 'Iris',
    getUrl: (id: string) => `https://iris.to/${id}`
  },
  lumilumi: {
    name: 'Lumilumi',
    getUrl: (id: string) => `https://lumilumi.app/${id}`
  },
  zapStream: {
    name: 'zap.stream',
    getUrl: (id: string) => `https://zap.stream/${id}`
  },
  yakihonne: {
    name: 'YakiHonne',
    getUrl: (id: string) => `https://yakihonne.com/${id}`
  },
  habla: {
    name: 'Habla',
    getUrl: (id: string) => `https://habla.news/a/${id}`
  },
  pareto: {
    name: 'Pareto',
    getUrl: (id: string) => `https://pareto.space/a/${id}`
  },
  njump: {
    name: 'Njump',
    getUrl: (id: string) => `https://njump.me/${id}`
  }
}

export default function ClientSelect({
  event,
  originalNoteId,
  ...props
}: ButtonProps & {
  event?: Event
  originalNoteId?: string
}) {
  const { isSmallScreen } = useScreenSize()
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  const supportedClients = useMemo(() => {
    let kind: number | undefined
    if (event) {
      kind = event.kind
    } else if (originalNoteId) {
      try {
        const pointer = nip19.decode(originalNoteId)
        if (pointer.type === 'naddr') {
          kind = pointer.data.kind
        }
      } catch (error) {
        console.error('Failed to decode NIP-19 pointer:', error)
        return ['njump']
      }
    }
    if (!kind) {
      return ['njump']
    }

    switch (kind) {
      case kinds.LongFormArticle:
      case kinds.DraftLong:
        return ['yakihonne', 'coracle', 'habla', 'lumilumi', 'pareto', 'njump']
      case kinds.LiveEvent:
        return ['zapStream', 'nostrudel', 'njump']
      case kinds.Date:
      case kinds.Time:
        return ['coracle', 'njump']
      case kinds.CommunityDefinition:
        return ['coracle', 'snort', 'njump']
      default:
        return ['njump']
    }
  }, [event])

  if (!originalNoteId && !event) {
    return null
  }

  const content = (
    <div className="space-y-2">
      {event?.kind === ExtendedKind.GROUP_METADATA ? (
        <RelayBasedGroupChatSelector
          event={event}
          originalNoteId={originalNoteId}
          setOpen={setOpen}
        />
      ) : (
        supportedClients.map((clientId) => {
          const client = clients[clientId]
          if (!client) return null

          return (
            <ClientSelectItem
              key={clientId}
              onClick={() => setOpen(false)}
              href={client.getUrl(originalNoteId ?? getNoteBech32Id(event!))}
              name={client.name}
            />
          )
        })
      )}
      <Separator />
      <Button
        variant="ghost"
        className="w-full py-6 font-semibold"
        onClick={() => {
          navigator.clipboard.writeText(originalNoteId ?? getNoteBech32Id(event!))
          setOpen(false)
        }}
      >
        {t('Copy event ID')}
      </Button>
    </div>
  )

  const trigger = (
    <Button variant="outline" {...props}>
      <ExternalLink /> {t('Open in another client')}
    </Button>
  )

  if (isSmallScreen) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerOverlay
            onClick={(e) => {
              e.stopPropagation()
              setOpen(false)
            }}
          />
          <DrawerContent hideOverlay>{content}</DrawerContent>
        </Drawer>
      </div>
    )
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="px-8" onOpenAutoFocus={(e) => e.preventDefault()}>
          {content}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function RelayBasedGroupChatSelector({
  event,
  originalNoteId,
  setOpen
}: {
  event: Event
  setOpen: Dispatch<SetStateAction<boolean>>
  originalNoteId?: string
}) {
  const { relay, id } = useMemo(() => {
    let relay: string | undefined
    if (originalNoteId) {
      const pointer = nip19.decode(originalNoteId)
      if (pointer.type === 'naddr' && pointer.data.relays?.length) {
        relay = pointer.data.relays[0]
      }
    }
    if (!relay) {
      relay = clientService.getEventHint(event.id)
    }

    return { relay, id: getReplaceableEventIdentifier(event) }
  }, [event, originalNoteId])

  return (
    <ClientSelectItem
      onClick={() => setOpen(false)}
      href={toChachiChat(relay, id)}
      name="Chachi Chat"
    />
  )
}

function ClientSelectItem({
  onClick,
  href,
  name
}: {
  onClick: () => void
  href: string
  name: string
}) {
  return (
    <Button asChild variant="ghost" className="w-full py-6 font-semibold" onClick={onClick}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        {name}
      </a>
    </Button>
  )
}
