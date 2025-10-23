import { getNoteBech32Id, isProtectedEvent } from '@/lib/event'
import { toNjump } from '@/lib/link'
import { pubkeyToNpub } from '@/lib/pubkey'
import { simplifyUrl } from '@/lib/url'
import { useCurrentRelays } from '@/providers/CurrentRelaysProvider'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import { usePinList } from '@/providers/PinListProvider'
import client from '@/services/client.service'
import {
  Bell,
  BellOff,
  Code,
  Copy,
  Link,
  Pin,
  PinOff,
  SatelliteDish,
  Trash2,
  TriangleAlert
} from 'lucide-react'
import { Event, kinds } from 'nostr-tools'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import RelayIcon from '../RelayIcon'

export interface SubMenuAction {
  label: React.ReactNode
  onClick: () => void
  className?: string
  separator?: boolean
}

export interface MenuAction {
  icon: React.ComponentType
  label: string
  onClick?: () => void
  className?: string
  separator?: boolean
  subMenu?: SubMenuAction[]
}

interface UseMenuActionsProps {
  event: Event
  closeDrawer: () => void
  showSubMenuActions: (subMenu: SubMenuAction[], title: string) => void
  setIsRawEventDialogOpen: (open: boolean) => void
  setIsReportDialogOpen: (open: boolean) => void
  isSmallScreen: boolean
}

export function useMenuActions({
  event,
  closeDrawer,
  showSubMenuActions,
  setIsRawEventDialogOpen,
  setIsReportDialogOpen,
  isSmallScreen
}: UseMenuActionsProps) {
  const { t } = useTranslation()
  const { pubkey, attemptDelete } = useNostr()
  const { relayUrls: currentBrowsingRelayUrls } = useCurrentRelays()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const relayUrls = useMemo(() => {
    return Array.from(new Set(currentBrowsingRelayUrls.concat(favoriteRelays)))
  }, [currentBrowsingRelayUrls, favoriteRelays])
  const { mutePubkeyPublicly, mutePubkeyPrivately, unmutePubkey, mutePubkeySet } = useMuteList()
  const { pinnedEventHexIdSet, pin, unpin } = usePinList()
  const isMuted = useMemo(() => mutePubkeySet.has(event.pubkey), [mutePubkeySet, event])

  const broadcastSubMenu: SubMenuAction[] = useMemo(() => {
    const items = []
    if (pubkey && event.pubkey === pubkey) {
      items.push({
        label: <div className="text-left"> {t('Write relays')}</div>,
        onClick: async () => {
          closeDrawer()
          const promise = async () => {
            const relays = await client.determineTargetRelays(event)
            if (relays?.length) {
              await client.publishEvent(relays, event)
            }
          }
          toast.promise(promise, {
            loading: t('Republishing...'),
            success: () => {
              return t('Successfully republish to your write relays')
            },
            error: (err) => {
              return t('Failed to republish to your write relays: {{error}}', {
                error: err.message
              })
            }
          })
        }
      })
    }

    if (relaySets.length) {
      items.push(
        ...relaySets
          .filter((set) => set.relayUrls.length)
          .map((set, index) => ({
            label: <div className="text-left truncate">{set.name}</div>,
            onClick: async () => {
              closeDrawer()
              const promise = client.publishEvent(set.relayUrls, event)
              toast.promise(promise, {
                loading: t('Republishing...'),
                success: () => {
                  return t('Successfully republish to relay set: {{name}}', { name: set.name })
                },
                error: (err) => {
                  return t('Failed to republish to relay set: {{name}}. Error: {{error}}', {
                    name: set.name,
                    error: err.message
                  })
                }
              })
            },
            separator: index === 0
          }))
      )
    }

    if (relayUrls.length) {
      items.push(
        ...relayUrls.map((relay, index) => ({
          label: (
            <div className="flex items-center gap-2 w-full">
              <RelayIcon url={relay} />
              <div className="flex-1 truncate text-left">{simplifyUrl(relay)}</div>
            </div>
          ),
          onClick: async () => {
            closeDrawer()
            const promise = client.publishEvent([relay], event)
            toast.promise(promise, {
              loading: t('Republishing...'),
              success: () => {
                return t('Successfully republish to relay: {{url}}', { url: simplifyUrl(relay) })
              },
              error: (err) => {
                return t('Failed to republish to relay: {{url}}. Error: {{error}}', {
                  url: simplifyUrl(relay),
                  error: err.message
                })
              }
            })
          },
          separator: index === 0
        }))
      )
    }

    return items
  }, [pubkey, relayUrls, relaySets])

  const menuActions: MenuAction[] = useMemo(() => {
    const actions: MenuAction[] = [
      {
        icon: Copy,
        label: t('Copy event ID'),
        onClick: () => {
          navigator.clipboard.writeText(getNoteBech32Id(event))
          closeDrawer()
        }
      },
      {
        icon: Copy,
        label: t('Copy user ID'),
        onClick: () => {
          navigator.clipboard.writeText(pubkeyToNpub(event.pubkey) ?? '')
          closeDrawer()
        }
      },
      {
        icon: Link,
        label: t('Copy share link'),
        onClick: () => {
          navigator.clipboard.writeText(toNjump(getNoteBech32Id(event)))
          closeDrawer()
        }
      },
      {
        icon: Code,
        label: t('View raw event'),
        onClick: () => {
          closeDrawer()
          setIsRawEventDialogOpen(true)
        },
        separator: true
      }
    ]

    const isProtected = isProtectedEvent(event)
    if (!isProtected || event.pubkey === pubkey) {
      actions.push({
        icon: SatelliteDish,
        label: t('Republish to ...'),
        onClick: isSmallScreen
          ? () => showSubMenuActions(broadcastSubMenu, t('Republish to ...'))
          : undefined,
        subMenu: isSmallScreen ? undefined : broadcastSubMenu,
        separator: true
      })
    }

    if (event.pubkey === pubkey && event.kind === kinds.ShortTextNote) {
      const pinned = pinnedEventHexIdSet.has(event.id)
      actions.push({
        icon: pinned ? PinOff : Pin,
        label: pinned ? t('Unpin from profile') : t('Pin to profile'),
        onClick: async () => {
          closeDrawer()
          await (pinned ? unpin(event) : pin(event))
        }
      })
    }

    if (pubkey && event.pubkey !== pubkey) {
      actions.push({
        icon: TriangleAlert,
        label: t('Report'),
        className: 'text-destructive focus:text-destructive',
        onClick: () => {
          closeDrawer()
          setIsReportDialogOpen(true)
        },
        separator: true
      })
    }

    if (pubkey && event.pubkey !== pubkey) {
      if (isMuted) {
        actions.push({
          icon: Bell,
          label: t('Unmute user'),
          onClick: () => {
            closeDrawer()
            unmutePubkey(event.pubkey)
          },
          className: 'text-destructive focus:text-destructive',
          separator: true
        })
      } else {
        actions.push(
          {
            icon: BellOff,
            label: t('Mute user privately'),
            onClick: () => {
              closeDrawer()
              mutePubkeyPrivately(event.pubkey)
            },
            className: 'text-destructive focus:text-destructive',
            separator: true
          },
          {
            icon: BellOff,
            label: t('Mute user publicly'),
            onClick: () => {
              closeDrawer()
              mutePubkeyPublicly(event.pubkey)
            },
            className: 'text-destructive focus:text-destructive'
          }
        )
      }
    }

    if (pubkey && event.pubkey === pubkey) {
      actions.push({
        icon: Trash2,
        label: t('Try deleting this note'),
        onClick: () => {
          closeDrawer()
          attemptDelete(event)
        },
        className: 'text-destructive focus:text-destructive',
        separator: true
      })
    }

    return actions
  }, [
    t,
    event,
    pubkey,
    isMuted,
    isSmallScreen,
    broadcastSubMenu,
    pinnedEventHexIdSet,
    closeDrawer,
    showSubMenuActions,
    setIsRawEventDialogOpen,
    mutePubkeyPrivately,
    mutePubkeyPublicly,
    unmutePubkey
  ])

  return menuActions
}
