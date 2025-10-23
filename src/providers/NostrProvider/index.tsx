import LoginDialog from '@/components/LoginDialog'
import { ApplicationDataKey, BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import {
  createDeletionRequestDraftEvent,
  createFollowListDraftEvent,
  createMuteListDraftEvent,
  createRelayListDraftEvent,
  createSeenNotificationsAtDraftEvent
} from '@/lib/draft-event'
import {
  getLatestEvent,
  getReplaceableEventIdentifier,
  isProtectedEvent,
  minePow
} from '@/lib/event'
import { getProfileFromEvent, getRelayListFromEvent } from '@/lib/event-metadata'
import { formatPubkey, pubkeyToNpub } from '@/lib/pubkey'
import client from '@/services/client.service'
import customEmojiService from '@/services/custom-emoji.service'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import noteStatsService from '@/services/note-stats.service'
import {
  ISigner,
  TAccount,
  TAccountPointer,
  TDraftEvent,
  TProfile,
  TPublishOptions,
  TRelayList
} from '@/types'
import { hexToBytes } from '@noble/hashes/utils'
import dayjs from 'dayjs'
import { Event, kinds, VerifiedEvent } from 'nostr-tools'
import * as nip19 from 'nostr-tools/nip19'
import * as nip49 from 'nostr-tools/nip49'
import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useDeletedEvent } from '../DeletedEventProvider'
import { BunkerSigner } from './bunker.signer'
import { Nip07Signer } from './nip-07.signer'
import { NostrConnectionSigner } from './nostrConnection.signer'
import { NpubSigner } from './npub.signer'
import { NsecSigner } from './nsec.signer'

type TNostrContext = {
  isInitialized: boolean
  pubkey: string | null
  profile: TProfile | null
  profileEvent: Event | null
  relayList: TRelayList | null
  followListEvent: Event | null
  muteListEvent: Event | null
  bookmarkListEvent: Event | null
  favoriteRelaysEvent: Event | null
  userEmojiListEvent: Event | null
  pinListEvent: Event | null
  notificationsSeenAt: number
  account: TAccountPointer | null
  accounts: TAccountPointer[]
  nsec: string | null
  ncryptsec: string | null
  switchAccount: (account: TAccountPointer | null) => Promise<void>
  nsecLogin: (nsec: string, password?: string, needSetup?: boolean) => Promise<string>
  ncryptsecLogin: (ncryptsec: string) => Promise<string>
  nip07Login: () => Promise<string>
  bunkerLogin: (bunker: string) => Promise<string>
  nostrConnectionLogin: (clientSecretKey: Uint8Array, connectionString: string) => Promise<string>
  npubLogin(npub: string): Promise<string>
  removeAccount: (account: TAccountPointer) => void
  /**
   * Default publish the event to current relays, user's write relays and additional relays
   */
  publish: (draftEvent: TDraftEvent, options?: TPublishOptions) => Promise<Event>
  attemptDelete: (targetEvent: Event) => Promise<void>
  signHttpAuth: (url: string, method: string) => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<VerifiedEvent>
  nip04Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip04Decrypt: (pubkey: string, cipherText: string) => Promise<string>
  startLogin: () => void
  checkLogin: <T>(cb?: () => T) => Promise<T | void>
  updateRelayListEvent: (relayListEvent: Event) => Promise<void>
  updateProfileEvent: (profileEvent: Event) => Promise<void>
  updateFollowListEvent: (followListEvent: Event) => Promise<void>
  updateMuteListEvent: (muteListEvent: Event, privateTags: string[][]) => Promise<void>
  updateBookmarkListEvent: (bookmarkListEvent: Event) => Promise<void>
  updateFavoriteRelaysEvent: (favoriteRelaysEvent: Event) => Promise<void>
  updatePinListEvent: (pinListEvent: Event) => Promise<void>
  updateNotificationsSeenAt: (skipPublish?: boolean) => Promise<void>
}

const NostrContext = createContext<TNostrContext | undefined>(undefined)

const lastPublishedSeenNotificationsAtEventAtMap = new Map<string, number>()

export const useNostr = () => {
  const context = useContext(NostrContext)
  if (!context) {
    throw new Error('useNostr must be used within a NostrProvider')
  }
  return context
}

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { addDeletedEvent } = useDeletedEvent()
  const [accounts, setAccounts] = useState<TAccountPointer[]>(
    storage.getAccounts().map((act) => ({ pubkey: act.pubkey, signerType: act.signerType }))
  )
  const [account, setAccount] = useState<TAccountPointer | null>(null)
  const [nsec, setNsec] = useState<string | null>(null)
  const [ncryptsec, setNcryptsec] = useState<string | null>(null)
  const [signer, setSigner] = useState<ISigner | null>(null)
  const [openLoginDialog, setOpenLoginDialog] = useState(false)
  const [profile, setProfile] = useState<TProfile | null>(null)
  const [profileEvent, setProfileEvent] = useState<Event | null>(null)
  const [relayList, setRelayList] = useState<TRelayList | null>(null)
  const [followListEvent, setFollowListEvent] = useState<Event | null>(null)
  const [muteListEvent, setMuteListEvent] = useState<Event | null>(null)
  const [bookmarkListEvent, setBookmarkListEvent] = useState<Event | null>(null)
  const [favoriteRelaysEvent, setFavoriteRelaysEvent] = useState<Event | null>(null)
  const [userEmojiListEvent, setUserEmojiListEvent] = useState<Event | null>(null)
  const [pinListEvent, setPinListEvent] = useState<Event | null>(null)
  const [notificationsSeenAt, setNotificationsSeenAt] = useState(-1)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const init = async () => {
      if (hasNostrLoginHash()) {
        return await loginByNostrLoginHash()
      }

      const accounts = storage.getAccounts()
      const act = storage.getCurrentAccount() ?? accounts[0] // auto login the first account
      if (!act) return

      await loginWithAccountPointer(act)
    }
    init().then(() => {
      setIsInitialized(true)
    })

    const handleHashChange = () => {
      if (hasNostrLoginHash()) {
        loginByNostrLoginHash()
      }
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      setRelayList(null)
      setProfile(null)
      setProfileEvent(null)
      setNsec(null)
      setFavoriteRelaysEvent(null)
      setFollowListEvent(null)
      setMuteListEvent(null)
      setBookmarkListEvent(null)
      setPinListEvent(null)
      setNotificationsSeenAt(-1)
      if (!account) {
        return
      }

      const controller = new AbortController()
      const storedNsec = storage.getAccountNsec(account.pubkey)
      if (storedNsec) {
        setNsec(storedNsec)
      } else {
        setNsec(null)
      }
      const storedNcryptsec = storage.getAccountNcryptsec(account.pubkey)
      if (storedNcryptsec) {
        setNcryptsec(storedNcryptsec)
      } else {
        setNcryptsec(null)
      }

      const storedNotificationsSeenAt = storage.getLastReadNotificationTime(account.pubkey)

      const [
        storedRelayListEvent,
        storedProfileEvent,
        storedFollowListEvent,
        storedMuteListEvent,
        storedBookmarkListEvent,
        storedFavoriteRelaysEvent,
        storedUserEmojiListEvent,
        storedPinListEvent
      ] = await Promise.all([
        indexedDb.getReplaceableEvent(account.pubkey, kinds.RelayList),
        indexedDb.getReplaceableEvent(account.pubkey, kinds.Metadata),
        indexedDb.getReplaceableEvent(account.pubkey, kinds.Contacts),
        indexedDb.getReplaceableEvent(account.pubkey, kinds.Mutelist),
        indexedDb.getReplaceableEvent(account.pubkey, kinds.BookmarkList),
        indexedDb.getReplaceableEvent(account.pubkey, ExtendedKind.FAVORITE_RELAYS),
        indexedDb.getReplaceableEvent(account.pubkey, kinds.UserEmojiList),
        indexedDb.getReplaceableEvent(account.pubkey, kinds.Pinlist)
      ])
      if (storedRelayListEvent) {
        setRelayList(getRelayListFromEvent(storedRelayListEvent))
      }
      if (storedProfileEvent) {
        setProfileEvent(storedProfileEvent)
        setProfile(getProfileFromEvent(storedProfileEvent))
      }
      if (storedFollowListEvent) {
        setFollowListEvent(storedFollowListEvent)
      }
      if (storedMuteListEvent) {
        setMuteListEvent(storedMuteListEvent)
      }
      if (storedBookmarkListEvent) {
        setBookmarkListEvent(storedBookmarkListEvent)
      }
      if (storedFavoriteRelaysEvent) {
        setFavoriteRelaysEvent(storedFavoriteRelaysEvent)
      }
      if (storedUserEmojiListEvent) {
        setUserEmojiListEvent(storedUserEmojiListEvent)
      }
      if (storedPinListEvent) {
        setPinListEvent(storedPinListEvent)
      }

      const relayListEvents = await client.fetchEvents(BIG_RELAY_URLS, {
        kinds: [kinds.RelayList],
        authors: [account.pubkey]
      })
      const relayListEvent = getLatestEvent(relayListEvents) ?? storedRelayListEvent
      const relayList = getRelayListFromEvent(relayListEvent)
      if (relayListEvent) {
        client.updateRelayListCache(relayListEvent)
        await indexedDb.putReplaceableEvent(relayListEvent)
      }
      setRelayList(relayList)

      const events = await client.fetchEvents(relayList.write.concat(BIG_RELAY_URLS).slice(0, 4), [
        {
          kinds: [
            kinds.Metadata,
            kinds.Contacts,
            kinds.Mutelist,
            kinds.BookmarkList,
            ExtendedKind.FAVORITE_RELAYS,
            ExtendedKind.BLOSSOM_SERVER_LIST,
            kinds.UserEmojiList,
            kinds.Pinlist
          ],
          authors: [account.pubkey]
        },
        {
          kinds: [kinds.Application],
          authors: [account.pubkey],
          '#d': [ApplicationDataKey.NOTIFICATIONS_SEEN_AT]
        }
      ])
      const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
      const profileEvent = sortedEvents.find((e) => e.kind === kinds.Metadata)
      const followListEvent = sortedEvents.find((e) => e.kind === kinds.Contacts)
      const muteListEvent = sortedEvents.find((e) => e.kind === kinds.Mutelist)
      const bookmarkListEvent = sortedEvents.find((e) => e.kind === kinds.BookmarkList)
      const favoriteRelaysEvent = sortedEvents.find((e) => e.kind === ExtendedKind.FAVORITE_RELAYS)
      const blossomServerListEvent = sortedEvents.find(
        (e) => e.kind === ExtendedKind.BLOSSOM_SERVER_LIST
      )
      const userEmojiListEvent = sortedEvents.find((e) => e.kind === kinds.UserEmojiList)
      const notificationsSeenAtEvent = sortedEvents.find(
        (e) =>
          e.kind === kinds.Application &&
          getReplaceableEventIdentifier(e) === ApplicationDataKey.NOTIFICATIONS_SEEN_AT
      )
      const pinnedNotesEvent = sortedEvents.find((e) => e.kind === kinds.Pinlist)
      if (profileEvent) {
        const updatedProfileEvent = await indexedDb.putReplaceableEvent(profileEvent)
        if (updatedProfileEvent.id === profileEvent.id) {
          setProfileEvent(updatedProfileEvent)
          setProfile(getProfileFromEvent(updatedProfileEvent))
        }
      } else if (!storedProfileEvent) {
        setProfile({
          pubkey: account.pubkey,
          npub: pubkeyToNpub(account.pubkey) ?? '',
          username: formatPubkey(account.pubkey)
        })
      }
      if (followListEvent) {
        const updatedFollowListEvent = await indexedDb.putReplaceableEvent(followListEvent)
        if (updatedFollowListEvent.id === followListEvent.id) {
          setFollowListEvent(followListEvent)
        }
      }
      if (muteListEvent) {
        const updatedMuteListEvent = await indexedDb.putReplaceableEvent(muteListEvent)
        if (updatedMuteListEvent.id === muteListEvent.id) {
          setMuteListEvent(muteListEvent)
        }
      }
      if (bookmarkListEvent) {
        const updateBookmarkListEvent = await indexedDb.putReplaceableEvent(bookmarkListEvent)
        if (updateBookmarkListEvent.id === bookmarkListEvent.id) {
          setBookmarkListEvent(bookmarkListEvent)
        }
      }
      if (favoriteRelaysEvent) {
        const updatedFavoriteRelaysEvent = await indexedDb.putReplaceableEvent(favoriteRelaysEvent)
        if (updatedFavoriteRelaysEvent.id === favoriteRelaysEvent.id) {
          setFavoriteRelaysEvent(updatedFavoriteRelaysEvent)
        }
      }
      if (blossomServerListEvent) {
        await client.updateBlossomServerListEventCache(blossomServerListEvent)
      }
      if (userEmojiListEvent) {
        const updatedUserEmojiListEvent = await indexedDb.putReplaceableEvent(userEmojiListEvent)
        if (updatedUserEmojiListEvent.id === userEmojiListEvent.id) {
          setUserEmojiListEvent(updatedUserEmojiListEvent)
        }
      }
      if (pinnedNotesEvent) {
        const updatedPinnedNotesEvent = await indexedDb.putReplaceableEvent(pinnedNotesEvent)
        if (updatedPinnedNotesEvent.id === pinnedNotesEvent.id) {
          setPinListEvent(updatedPinnedNotesEvent)
        }
      }

      const notificationsSeenAt = Math.max(
        notificationsSeenAtEvent?.created_at ?? 0,
        storedNotificationsSeenAt
      )
      setNotificationsSeenAt(notificationsSeenAt)
      storage.setLastReadNotificationTime(account.pubkey, notificationsSeenAt)

      client.initUserIndexFromFollowings(account.pubkey, controller.signal)
      return controller
    }
    const promise = init()
    return () => {
      promise.then((controller) => {
        controller?.abort()
      })
    }
  }, [account])

  useEffect(() => {
    if (!account) return

    const initInteractions = async () => {
      const pubkey = account.pubkey
      const relayList = await client.fetchRelayList(pubkey)
      const events = await client.fetchEvents(relayList.write.slice(0, 4), [
        {
          authors: [pubkey],
          kinds: [kinds.Reaction, kinds.Repost],
          limit: 100
        },
        {
          '#P': [pubkey],
          kinds: [kinds.Zap],
          limit: 100
        }
      ])
      noteStatsService.updateNoteStatsByEvents(events)
    }
    initInteractions()
  }, [account])

  useEffect(() => {
    if (signer) {
      client.signer = signer
    } else {
      client.signer = undefined
    }
  }, [signer])

  useEffect(() => {
    if (account) {
      client.pubkey = account.pubkey
    } else {
      client.pubkey = undefined
    }
  }, [account])

  useEffect(() => {
    customEmojiService.init(userEmojiListEvent)
  }, [userEmojiListEvent])

  const hasNostrLoginHash = () => {
    return window.location.hash && window.location.hash.startsWith('#nostr-login')
  }

  const loginByNostrLoginHash = async () => {
    const credential = window.location.hash.replace('#nostr-login=', '')
    const urlWithoutHash = window.location.href.split('#')[0]
    history.replaceState(null, '', urlWithoutHash)

    if (credential.startsWith('bunker://')) {
      return await bunkerLogin(credential)
    } else if (credential.startsWith('ncryptsec')) {
      return await ncryptsecLogin(credential)
    } else if (credential.startsWith('nsec')) {
      return await nsecLogin(credential)
    }
  }

  const login = (signer: ISigner, act: TAccount) => {
    const newAccounts = storage.addAccount(act)
    setAccounts(newAccounts)
    storage.switchAccount(act)
    setAccount({ pubkey: act.pubkey, signerType: act.signerType })
    setSigner(signer)
    return act.pubkey
  }

  const removeAccount = (act: TAccountPointer) => {
    const newAccounts = storage.removeAccount(act)
    setAccounts(newAccounts)
    if (account?.pubkey === act.pubkey) {
      setAccount(null)
      setSigner(null)
    }
  }

  const switchAccount = async (act: TAccountPointer | null) => {
    if (!act) {
      storage.switchAccount(null)
      setAccount(null)
      setSigner(null)
      return
    }
    await loginWithAccountPointer(act)
  }

  const nsecLogin = async (nsecOrHex: string, password?: string, needSetup?: boolean) => {
    const nsecSigner = new NsecSigner()
    let privkey: Uint8Array
    if (nsecOrHex.startsWith('nsec')) {
      const { type, data } = nip19.decode(nsecOrHex)
      if (type !== 'nsec') {
        throw new Error('invalid nsec or hex')
      }
      privkey = data
    } else if (/^[0-9a-fA-F]{64}$/.test(nsecOrHex)) {
      privkey = hexToBytes(nsecOrHex)
    } else {
      throw new Error('invalid nsec or hex')
    }
    const pubkey = nsecSigner.login(privkey)
    if (password) {
      const ncryptsec = nip49.encrypt(privkey, password)
      login(nsecSigner, { pubkey, signerType: 'ncryptsec', ncryptsec })
    } else {
      login(nsecSigner, { pubkey, signerType: 'nsec', nsec: nip19.nsecEncode(privkey) })
    }
    if (needSetup) {
      setupNewUser(nsecSigner)
    }
    return pubkey
  }

  const ncryptsecLogin = async (ncryptsec: string) => {
    const password = prompt(t('Enter the password to decrypt your ncryptsec'))
    if (!password) {
      throw new Error('Password is required')
    }
    const privkey = nip49.decrypt(ncryptsec, password)
    const browserNsecSigner = new NsecSigner()
    const pubkey = browserNsecSigner.login(privkey)
    return login(browserNsecSigner, { pubkey, signerType: 'ncryptsec', ncryptsec })
  }

  const npubLogin = async (npub: string) => {
    const npubSigner = new NpubSigner()
    const pubkey = npubSigner.login(npub)
    return login(npubSigner, { pubkey, signerType: 'npub', npub })
  }

  const nip07Login = async () => {
    try {
      const nip07Signer = new Nip07Signer()
      await nip07Signer.init()
      const pubkey = await nip07Signer.getPublicKey()
      if (!pubkey) {
        throw new Error('You did not allow to access your pubkey')
      }
      return login(nip07Signer, { pubkey, signerType: 'nip-07' })
    } catch (err) {
      toast.error(t('Login failed') + ': ' + (err as Error).message)
      throw err
    }
  }

  const bunkerLogin = async (bunker: string) => {
    const bunkerSigner = new BunkerSigner()
    const pubkey = await bunkerSigner.login(bunker)
    if (!pubkey) {
      throw new Error('Invalid bunker')
    }
    const bunkerUrl = new URL(bunker)
    bunkerUrl.searchParams.delete('secret')
    return login(bunkerSigner, {
      pubkey,
      signerType: 'bunker',
      bunker: bunkerUrl.toString(),
      bunkerClientSecretKey: bunkerSigner.getClientSecretKey()
    })
  }

  const nostrConnectionLogin = async (clientSecretKey: Uint8Array, connectionString: string) => {
    const bunkerSigner = new NostrConnectionSigner(clientSecretKey, connectionString)
    const loginResult = await bunkerSigner.login()
    if (!loginResult.pubkey) {
      throw new Error('Invalid bunker')
    }
    const bunkerUrl = new URL(loginResult.bunkerString!)
    bunkerUrl.searchParams.delete('secret')
    return login(bunkerSigner, {
      pubkey: loginResult.pubkey,
      signerType: 'bunker',
      bunker: bunkerUrl.toString(),
      bunkerClientSecretKey: bunkerSigner.getClientSecretKey()
    })
  }

  const loginWithAccountPointer = async (act: TAccountPointer): Promise<string | null> => {
    let account = storage.findAccount(act)
    if (!account) {
      return null
    }
    if (account.signerType === 'nsec' || account.signerType === 'browser-nsec') {
      if (account.nsec) {
        const browserNsecSigner = new NsecSigner()
        browserNsecSigner.login(account.nsec)
        // Migrate to nsec
        if (account.signerType === 'browser-nsec') {
          storage.removeAccount(account)
          account = { ...account, signerType: 'nsec' }
          storage.addAccount(account)
        }
        return login(browserNsecSigner, account)
      }
    } else if (account.signerType === 'ncryptsec') {
      if (account.ncryptsec) {
        const password = prompt(t('Enter the password to decrypt your ncryptsec'))
        if (!password) {
          return null
        }
        const privkey = nip49.decrypt(account.ncryptsec, password)
        const browserNsecSigner = new NsecSigner()
        browserNsecSigner.login(privkey)
        return login(browserNsecSigner, account)
      }
    } else if (account.signerType === 'nip-07') {
      const nip07Signer = new Nip07Signer()
      await nip07Signer.init()
      return login(nip07Signer, account)
    } else if (account.signerType === 'bunker') {
      if (account.bunker && account.bunkerClientSecretKey) {
        const bunkerSigner = new BunkerSigner(account.bunkerClientSecretKey)
        const pubkey = await bunkerSigner.login(account.bunker, false)
        if (!pubkey) {
          storage.removeAccount(account)
          return null
        }
        if (pubkey !== account.pubkey) {
          storage.removeAccount(account)
          account = { ...account, pubkey }
          storage.addAccount(account)
        }
        return login(bunkerSigner, account)
      }
    } else if (account.signerType === 'npub' && account.npub) {
      const npubSigner = new NpubSigner()
      const pubkey = npubSigner.login(account.npub)
      if (!pubkey) {
        storage.removeAccount(account)
        return null
      }
      if (pubkey !== account.pubkey) {
        storage.removeAccount(account)
        account = { ...account, pubkey }
        storage.addAccount(account)
      }
      return login(npubSigner, account)
    }
    storage.removeAccount(account)
    return null
  }

  const setupNewUser = async (signer: ISigner) => {
    await Promise.allSettled([
      client.publishEvent(BIG_RELAY_URLS, await signer.signEvent(createFollowListDraftEvent([]))),
      client.publishEvent(BIG_RELAY_URLS, await signer.signEvent(createMuteListDraftEvent([]))),
      client.publishEvent(
        BIG_RELAY_URLS,
        await signer.signEvent(
          createRelayListDraftEvent(BIG_RELAY_URLS.map((url) => ({ url, scope: 'both' })))
        )
      )
    ])
  }

  const signEvent = async (draftEvent: TDraftEvent) => {
    const event = await signer?.signEvent(draftEvent)
    if (!event) {
      throw new Error('sign event failed')
    }
    return event as VerifiedEvent
  }

  const publish = async (
    draftEvent: TDraftEvent,
    { minPow = 0, ...options }: TPublishOptions = {}
  ) => {
    if (!account || !signer || account.signerType === 'npub') {
      throw new Error('You need to login first')
    }

    const draft = JSON.parse(JSON.stringify(draftEvent)) as TDraftEvent
    let event: VerifiedEvent
    if (minPow > 0) {
      const unsignedEvent = await minePow({ ...draft, pubkey: account.pubkey }, minPow)
      event = await signEvent(unsignedEvent)
    } else {
      event = await signEvent(draft)
    }

    if (event.kind !== kinds.Application && event.pubkey !== account.pubkey) {
      const eventAuthor = await client.fetchProfile(event.pubkey)
      const result = confirm(
        t(
          'You are about to publish an event signed by [{{eventAuthorName}}]. You are currently logged in as [{{currentUsername}}]. Are you sure?',
          { eventAuthorName: eventAuthor?.username, currentUsername: profile?.username }
        )
      )
      if (!result) {
        throw new Error(t('Cancelled'))
      }
    }

    const relays = await client.determineTargetRelays(event, options)

    await client.publishEvent(relays, event)
    return event
  }

  const attemptDelete = async (targetEvent: Event) => {
    if (!signer) {
      throw new Error(t('You need to login first'))
    }
    if (account?.pubkey !== targetEvent.pubkey) {
      throw new Error(t('You can only delete your own notes'))
    }

    const deletionRequest = await signEvent(createDeletionRequestDraftEvent(targetEvent))

    const seenOn = client.getSeenEventRelayUrls(targetEvent.id)
    const relays = await client.determineTargetRelays(targetEvent, {
      specifiedRelayUrls: isProtectedEvent(targetEvent) ? seenOn : undefined,
      additionalRelayUrls: seenOn
    })

    await client.publishEvent(relays, deletionRequest)

    addDeletedEvent(targetEvent)
    toast.success(t('Deletion request sent to {{count}} relays', { count: relays.length }))
  }

  const signHttpAuth = async (url: string, method: string, content = '') => {
    const event = await signEvent({
      content,
      kind: kinds.HTTPAuth,
      created_at: dayjs().unix(),
      tags: [
        ['u', url],
        ['method', method]
      ]
    })
    return 'Nostr ' + btoa(JSON.stringify(event))
  }

  const nip04Encrypt = async (pubkey: string, plainText: string) => {
    return signer?.nip04Encrypt(pubkey, plainText) ?? ''
  }

  const nip04Decrypt = async (pubkey: string, cipherText: string) => {
    return signer?.nip04Decrypt(pubkey, cipherText) ?? ''
  }

  const checkLogin = async <T,>(cb?: () => T): Promise<T | void> => {
    if (signer) {
      return cb && cb()
    }
    return setOpenLoginDialog(true)
  }

  const updateRelayListEvent = async (relayListEvent: Event) => {
    const newRelayList = await indexedDb.putReplaceableEvent(relayListEvent)
    setRelayList(getRelayListFromEvent(newRelayList))
  }

  const updateProfileEvent = async (profileEvent: Event) => {
    const newProfileEvent = await indexedDb.putReplaceableEvent(profileEvent)
    setProfileEvent(newProfileEvent)
    setProfile(getProfileFromEvent(newProfileEvent))
  }

  const updateFollowListEvent = async (followListEvent: Event) => {
    const newFollowListEvent = await indexedDb.putReplaceableEvent(followListEvent)
    if (newFollowListEvent.id !== followListEvent.id) return

    setFollowListEvent(newFollowListEvent)
    await client.updateFollowListCache(newFollowListEvent)
  }

  const updateMuteListEvent = async (muteListEvent: Event, privateTags: string[][]) => {
    const newMuteListEvent = await indexedDb.putReplaceableEvent(muteListEvent)
    if (newMuteListEvent.id !== muteListEvent.id) return

    await indexedDb.putMuteDecryptedTags(muteListEvent.id, privateTags)
    setMuteListEvent(muteListEvent)
  }

  const updateBookmarkListEvent = async (bookmarkListEvent: Event) => {
    const newBookmarkListEvent = await indexedDb.putReplaceableEvent(bookmarkListEvent)
    if (newBookmarkListEvent.id !== bookmarkListEvent.id) return

    setBookmarkListEvent(newBookmarkListEvent)
  }

  const updateFavoriteRelaysEvent = async (favoriteRelaysEvent: Event) => {
    const newFavoriteRelaysEvent = await indexedDb.putReplaceableEvent(favoriteRelaysEvent)
    if (newFavoriteRelaysEvent.id !== favoriteRelaysEvent.id) return

    setFavoriteRelaysEvent(newFavoriteRelaysEvent)
  }

  const updatePinListEvent = async (pinListEvent: Event) => {
    const newPinListEvent = await indexedDb.putReplaceableEvent(pinListEvent)
    if (newPinListEvent.id !== pinListEvent.id) return

    setPinListEvent(newPinListEvent)
  }

  const updateNotificationsSeenAt = async (skipPublish = false) => {
    if (!account) return

    const now = dayjs().unix()
    storage.setLastReadNotificationTime(account.pubkey, now)
    setTimeout(() => {
      setNotificationsSeenAt(now)
    }, 5_000)

    // Prevent too frequent requests for signing seen notifications events
    const lastPublishedSeenNotificationsAtEventAt =
      lastPublishedSeenNotificationsAtEventAtMap.get(account.pubkey) ?? -1
    if (
      !skipPublish &&
      (lastPublishedSeenNotificationsAtEventAt < 0 ||
        now - lastPublishedSeenNotificationsAtEventAt > 10 * 60) // 10 minutes
    ) {
      await publish(createSeenNotificationsAtDraftEvent())
      lastPublishedSeenNotificationsAtEventAtMap.set(account.pubkey, now)
    }
  }

  return (
    <NostrContext.Provider
      value={{
        isInitialized,
        pubkey: account?.pubkey ?? null,
        profile,
        profileEvent,
        relayList,
        followListEvent,
        muteListEvent,
        bookmarkListEvent,
        favoriteRelaysEvent,
        userEmojiListEvent,
        pinListEvent,
        notificationsSeenAt,
        account,
        accounts,
        nsec,
        ncryptsec,
        switchAccount,
        nsecLogin,
        ncryptsecLogin,
        nip07Login,
        bunkerLogin,
        nostrConnectionLogin,
        npubLogin,
        removeAccount,
        publish,
        attemptDelete,
        signHttpAuth,
        nip04Encrypt,
        nip04Decrypt,
        startLogin: () => setOpenLoginDialog(true),
        checkLogin,
        signEvent,
        updateRelayListEvent,
        updateProfileEvent,
        updateFollowListEvent,
        updateMuteListEvent,
        updateBookmarkListEvent,
        updateFavoriteRelaysEvent,
        updatePinListEvent,
        updateNotificationsSeenAt
      }}
    >
      {children}
      <LoginDialog open={openLoginDialog} setOpen={setOpenLoginDialog} />
    </NostrContext.Provider>
  )
}
