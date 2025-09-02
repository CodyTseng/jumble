import { getNoteBech32Id, isProtectedEvent } from '@/lib/event'
import { toNjump } from '@/lib/link'
import { pubkeyToNpub } from '@/lib/pubkey'
import { simplifyUrl } from '@/lib/url'
import { useFavoriteRelays } from '@/providers/FavoriteRelaysProvider'
import { useMuteList } from '@/providers/MuteListProvider'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { Bell, BellOff, Code, Copy, Link, Mail, SatelliteDish, Server, Trash2 } from 'lucide-react'
import { Event } from 'nostr-tools'
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
  isSmallScreen: boolean
}

export function useMenuActions({
  event,
  closeDrawer,
  showSubMenuActions,
  setIsRawEventDialogOpen,
  isSmallScreen
}: UseMenuActionsProps) {
  const { t } = useTranslation()
  const { pubkey, attemptDelete } = useNostr()
  const { relaySets, favoriteRelays } = useFavoriteRelays()
  const { mutePubkeyPublicly, mutePubkeyPrivately, unmutePubkey, mutePubkeySet } = useMuteList()
  const isMuted = useMemo(() => mutePubkeySet.has(event.pubkey), [mutePubkeySet, event])

  const broadcastSubMenu: SubMenuAction[] = useMemo(() => {
    const items = []
    if (pubkey && event.pubkey === pubkey) {
      items.push({
        label: (
          <div className="flex items-center gap-2 w-full pl-1">
            <Mail />
            <div className="flex-1 truncate text-left">{t('Suitable Relays')}</div>
          </div>
        ),
        onClick: async () => {
          closeDrawer()
          const relays = await client.determineTargetRelays(event)
          if (relays?.length) {
            await client
              .publishEvent(relays, event)
              .then(() => {
                toast.success(t('Successfully republish to your write relays'))
              })
              .catch((error) => {
                toast.error(
                  t('Failed to republish to your write relays: {{error}}', { error: error.message })
                )
              })
          }
        }
      })
    }

    if (relaySets.length) {
      items.push(
        ...relaySets
          .filter((set) => set.relayUrls.length)
          .map((set, index) => ({
            label: (
              <div className="flex items-center gap-2 w-full pl-1">
                <Server />
                <div className="flex-1 truncate text-left">{set.name}</div>
              </div>
            ),
            onClick: async () => {
              closeDrawer()
              await client
                .publishEvent(set.relayUrls, event)
                .then(() => {
                  toast.success(
                    t('Successfully republish to relay set: {{name}}', { name: set.name })
                  )
                })
                .catch((error) => {
                  toast.error(
                    t('Failed to republish to relay set: {{name}}. Error: {{error}}', {
                      name: set.name,
                      error: error.message
                    })
                  )
                })
            },
            separator: index === 0
          }))
      )
    }

    if (favoriteRelays.length) {
      items.push(
        ...favoriteRelays.map((relay, index) => ({
          label: (
            <div className="flex items-center gap-2 w-full">
              <RelayIcon url={relay} />
              <div className="flex-1 truncate text-left">{simplifyUrl(relay)}</div>
            </div>
          ),
          onClick: async () => {
            closeDrawer()
            await client
              .publishEvent([relay], event)
              .then(() => {
                toast.success(
                  t('Successfully republish to relay: {{url}}', { url: simplifyUrl(relay) })
                )
              })
              .catch((error) => {
                toast.error(
                  t('Failed to republish to relay: {{url}}. Error: {{error}}', {
                    url: simplifyUrl(relay),
                    error: error.message
                  })
                )
              })
          },
          separator: index === 0
        }))
      )
    }

    return items
  }, [pubkey, favoriteRelays, relaySets])

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
    closeDrawer,
    showSubMenuActions,
    setIsRawEventDialogOpen,
    mutePubkeyPrivately,
    mutePubkeyPublicly,
    unmutePubkey
  ])

  return menuActions
}
