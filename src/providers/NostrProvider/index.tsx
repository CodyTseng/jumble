import LoginDialog from '@/components/LoginDialog'
import PasswordInputDialog from '@/components/PasswordInputDialog'
import { ApplicationDataKey, ExtendedKind } from '@/constants'
import {
  createDeletionRequestDraftEvent,
  createFollowListDraftEvent,
  createMuteListDraftEvent,
  createRelayListDraftEvent,
  createSeenNotificationsAtDraftEvent
} from '@/lib/draft-event'
import { getReplaceableCoordinateFromEvent, isProtectedEvent, minePow } from '@/lib/event'
import { getProfileFromEvent, getRelayListFromEvent } from '@/lib/event-metadata'
import { formatPubkey, pubkeyToNpub } from '@/lib/pubkey'
import { getDefaultRelayUrls } from '@/lib/relay'
import { isSameAccount } from '@/lib/account'
import client from '@/services/client.service'
import customEmojiService from '@/services/custom-emoji.service'
import dmService from '@/services/dm.service'
import encryptionKeyService from '@/services/encryption-key.service'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import stuffStatsService from '@/services/stuff-stats.service'
import {
  ISigner,
  TAccount,
  TAccountPointer,
  TDraftEvent,
  TEncryptionKeypair,
  TProfile,
  TPublishOptions,
  TRelayList
} from '@/types'
import { hexToBytes } from '@noble/hashes/utils'
import dayjs from 'dayjs'
import { Event, kinds, VerifiedEvent } from 'nostr-tools'
import * as nip19 from 'nostr-tools/nip19'
import * as nip49 from 'nostr-tools/nip49'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useDeletedEvent } from '../DeletedEventProvider'
import { BunkerSigner } from './bunker.signer'
import { Nip07Signer } from './nip-07.signer'
import { NostrConnectionSigner } from './nostrConnection.signer'
import { NpubSigner } from './npub.signer'
import { NsecSigner } from './nsec.signer'
import { createSelfEventSync, SELF_EVENT_KINDS } from './self-event-sync'

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
  pinnedUsersEvent: Event | null
  notificationsSeenAt: number
  account: TAccountPointer | null
  accounts: TAccountPointer[]
  nsec: string | null
  ncryptsec: string | null
  switchAccount: (account: TAccountPointer | null) => Promise<void>
  /**
   * Build a signer for the given account WITHOUT changing the active account.
   * Used to publish "as" another account temporarily. Returns null if the
   * account can't sign (e.g. npub read-only) or its identity can't be verified.
   */
  getSignerForAccount: (account: TAccount) => Promise<ISigner | null>
  /**
   * The active account's private key when it signs locally (nsec/ncryptsec),
   * already decrypted in memory; null for remote/read-only signers. Used by the
   * "Bind Google account" flow to register the existing key's shards.
   */
  getActivePrivkey: () => Uint8Array | null
  nsecLogin: (nsec: string, password?: string, needSetup?: boolean) => Promise<string>
  ncryptsecLogin: (ncryptsec: string) => Promise<string>
  nip07Login: () => Promise<string>
  bunkerLogin: (bunker: string, pomegranateCentral?: string) => Promise<string>
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
  nip44Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip44Decrypt: (pubkey: string, cipherText: string) => Promise<string>
  signer: ISigner | null
  hasEncryptionKey: () => boolean
  getEncryptionKeypair: () => TEncryptionKeypair | null
  ensureEncryptionKey: () => Promise<TEncryptionKeypair>
  startLogin: () => void
  checkLogin: <T>(cb?: () => T) => Promise<T | void>
  updateRelayListEvent: (relayListEvent: Event) => Promise<void>
  updateProfileEvent: (profileEvent: Event) => Promise<void>
  updateFollowListEvent: (followListEvent: Event) => Promise<void>
  updateMuteListEvent: (muteListEvent: Event, privateTags: string[][]) => Promise<void>
  updateBookmarkListEvent: (bookmarkListEvent: Event) => Promise<void>
  updateFavoriteRelaysEvent: (favoriteRelaysEvent: Event) => Promise<void>
  updateUserEmojiListEvent: (userEmojiListEvent: Event) => Promise<void>
  updatePinListEvent: (pinListEvent: Event) => Promise<void>
  updatePinnedUsersEvent: (pinnedUsersEvent: Event, privateTags?: string[][]) => Promise<void>
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
  const [pinnedUsersEvent, setPinnedUsersEvent] = useState<Event | null>(null)
  const [bookmarkListEvent, setBookmarkListEvent] = useState<Event | null>(null)
  const [favoriteRelaysEvent, setFavoriteRelaysEvent] = useState<Event | null>(null)
  const [userEmojiListEvent, setUserEmojiListEvent] = useState<Event | null>(null)
  const [pinListEvent, setPinListEvent] = useState<Event | null>(null)
  const [notificationsSeenAt, setNotificationsSeenAt] = useState(-1)
  const [isInitialized, setIsInitialized] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const selfEventSyncRef = useRef<{
    pubkey: string
    sync: ReturnType<typeof createSelfEventSync>
  } | null>(null)
  const passwordPromiseRef = useRef<{
    resolve: (password: string) => void
    reject: () => void
  } | null>(null)

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
    const controller = new AbortController()
    setRelayList(null)
    setProfile(null)
    setProfileEvent(null)
    setNsec(null)
    setNcryptsec(null)
    setFavoriteRelaysEvent(null)
    setFollowListEvent(null)
    setMuteListEvent(null)
    setBookmarkListEvent(null)
    setUserEmojiListEvent(null)
    setPinListEvent(null)
    setPinnedUsersEvent(null)
    setNotificationsSeenAt(-1)
    if (!account) return

    const pubkey = account.pubkey
    const defaultRelays = getDefaultRelayUrls()
    let accountRelays = defaultRelays
    setNsec(storage.getAccountNsec(pubkey) ?? null)
    setNcryptsec(storage.getAccountNcryptsec(pubkey) ?? null)
    setProfile({ pubkey, npub: pubkeyToNpub(pubkey) ?? '', username: formatPubkey(pubkey) })
    setRelayList(getRelayListFromEvent(null, storage.getFilterOutOnionRelays()))
    setNotificationsSeenAt(Math.max(0, storage.getLastReadNotificationTime(pubkey)))

    const sync = createSelfEventSync({
      pubkey,
      since: dayjs().unix(),
      relays: defaultRelays,
      subscribe: (urls, filter, handlers) => client.subscribe(urls, filter, handlers),
      persist: (event) =>
        event.kind === kinds.Application
          ? Promise.resolve(event)
          : client.updateAccountEventCache(event),
      apply: (event) => {
        switch (event.kind) {
          case kinds.RelayList: {
            const nextRelayList = getRelayListFromEvent(event, storage.getFilterOutOnionRelays())
            accountRelays = Array.from(new Set([...nextRelayList.write, ...defaultRelays]))
            setRelayList(nextRelayList)
            sync.setRelays([...accountRelays, ...nextRelayList.read])
            break
          }
          case kinds.Metadata:
            setProfileEvent(event)
            setProfile(getProfileFromEvent(event))
            break
          case kinds.Contacts:
            setFollowListEvent(event)
            break
          case kinds.Mutelist:
            setMuteListEvent(event)
            break
          case kinds.BookmarkList:
            setBookmarkListEvent(event)
            break
          case ExtendedKind.FAVORITE_RELAYS:
            setFavoriteRelaysEvent(event)
            break
          case kinds.UserEmojiList:
            setUserEmojiListEvent(event)
            break
          case kinds.Emojisets: {
            const coordinate = getReplaceableCoordinateFromEvent(event)
            setUserEmojiListEvent((previous) =>
              previous?.tags.some(([name, value]) => name === 'a' && value === coordinate)
                ? { ...previous }
                : previous
            )
            break
          }
          case kinds.Relaysets: {
            const coordinate = getReplaceableCoordinateFromEvent(event)
            setFavoriteRelaysEvent((previous) =>
              previous?.tags.some(([name, value]) => name === 'a' && value === coordinate)
                ? { ...previous }
                : previous
            )
            break
          }
          case kinds.Pinlist:
            setPinListEvent(event)
            break
          case ExtendedKind.PINNED_USERS:
            setPinnedUsersEvent(event)
            break
          case kinds.Application: {
            const seenAt = Math.max(event.created_at, storage.getLastReadNotificationTime(pubkey))
            storage.setLastReadNotificationTime(pubkey, seenAt)
            setNotificationsSeenAt((previous) => Math.max(previous, seenAt))
            break
          }
        }
      },
      onOtherEvent: (event) => {
        client.addEventToCache(event)
        stuffStatsService.updateStuffStatsByEvents([event])
      },
      onError: (error) => console.error('Failed to sync account event:', error)
    })
    selfEventSyncRef.current = { pubkey, sync }

    const init = async () => {
      const storedEvents = await Promise.all(
        SELF_EVENT_KINDS.filter((kind) => !kinds.isAddressableKind(kind)).map((kind) =>
          indexedDb.getReplaceableEvent(pubkey, kind)
        )
      )
      if (controller.signal.aborted) return
      for (const event of storedEvents) {
        if (event) await sync.receive(event)
      }
      if (controller.signal.aborted) return

      const relayListEvents = await client.fetchEvents(defaultRelays, {
        kinds: [kinds.RelayList],
        authors: [pubkey]
      })
      if (controller.signal.aborted) return
      for (const event of relayListEvents) await sync.receive(event)
      if (controller.signal.aborted) return

      const events = await client.fetchEvents(accountRelays, [
        { kinds: SELF_EVENT_KINDS, authors: [pubkey] },
        {
          kinds: [kinds.Application],
          authors: [pubkey],
          '#d': [ApplicationDataKey.NOTIFICATIONS_SEEN_AT]
        }
      ])
      if (controller.signal.aborted) return
      for (const event of events) await sync.receive(event)
      if (!controller.signal.aborted) {
        void client.initUserIndexFromFollowings(pubkey, controller.signal)
      }
    }
    void init().catch((error) => {
      if (!controller.signal.aborted) console.error('Failed to load account events:', error)
    })
    return () => {
      controller.abort()
      sync.dispose()
      if (selfEventSyncRef.current?.sync === sync) selfEventSyncRef.current = null
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
      stuffStatsService.updateStuffStatsByEvents(events)
    }
    initInteractions()
  }, [account])

  useEffect(() => {
    if (!account) return

    const initDm = async () => {
      const encryptionKeypair = encryptionKeyService.getEncryptionKeypair(account.pubkey)
      if (!encryptionKeypair) return

      try {
        await dmService.init(account.pubkey, encryptionKeypair)
      } catch (error) {
        console.error('Failed to initialize DM service:', error)
      }
    }
    initDm()

    return () => {
      dmService.destroy()
    }
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

  const requestPassword = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      passwordPromiseRef.current = { resolve, reject }
      setPasswordDialogOpen(true)
    })
  }

  const handlePasswordConfirm = (password: string) => {
    passwordPromiseRef.current?.resolve(password)
    passwordPromiseRef.current = null
    setPasswordDialogOpen(false)
  }

  const handlePasswordCancel = () => {
    passwordPromiseRef.current?.reject()
    passwordPromiseRef.current = null
    setPasswordDialogOpen(false)
  }

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

  const getActivePrivkey = () => {
    return signer instanceof NsecSigner ? signer.getPrivkey() : null
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
    const password = await requestPassword()
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

  // `pomegranateCentral` is set for accounts created via "Login with Google";
  // persisting it marks the account as a pomegranate account.
  const bunkerLogin = async (bunker: string, pomegranateCentral?: string) => {
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
      bunkerClientSecretKey: bunkerSigner.getClientSecretKey(),
      ...(pomegranateCentral ? { pomegranateCentral } : {})
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
        try {
          const password = await requestPassword()
          const privkey = nip49.decrypt(account.ncryptsec, password)
          const browserNsecSigner = new NsecSigner()
          browserNsecSigner.login(privkey)
          return login(browserNsecSigner, account)
        } catch {
          return null
        }
      }
    } else if (account.signerType === 'nip-07') {
      const nip07Signer = new Nip07Signer()
      await nip07Signer.init()
      return login(nip07Signer, account)
    } else if (account.signerType === 'bunker') {
      if (account.bunker && account.bunkerClientSecretKey) {
        const bunkerSigner = new BunkerSigner(account.bunkerClientSecretKey)
        await bunkerSigner.login(account.bunker, false)
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
    // Missing credentials can be caused by a transient safeStorage or IPC
    // failure. Automatic login must never turn that into destructive logout.
    return null
  }

  // Construct a signer instance for an account without touching global state or
  // storage (no migrations, no account removal). npub accounts are read-only and
  // return null.
  const buildSignerForAccount = async (account: TAccount): Promise<ISigner | null> => {
    if (account.signerType === 'nsec' || account.signerType === 'browser-nsec') {
      if (account.nsec) {
        const nsecSigner = new NsecSigner()
        nsecSigner.login(account.nsec)
        return nsecSigner
      }
    } else if (account.signerType === 'ncryptsec') {
      if (account.ncryptsec) {
        const password = await requestPassword()
        const privkey = nip49.decrypt(account.ncryptsec, password)
        const nsecSigner = new NsecSigner()
        nsecSigner.login(privkey)
        return nsecSigner
      }
    } else if (account.signerType === 'nip-07') {
      const nip07Signer = new Nip07Signer()
      await nip07Signer.init()
      return nip07Signer
    } else if (account.signerType === 'bunker') {
      if (account.bunker && account.bunkerClientSecretKey) {
        const bunkerSigner = new BunkerSigner(account.bunkerClientSecretKey)
        await bunkerSigner.login(account.bunker, false)
        return bunkerSigner
      }
    }
    return null
  }

  const getSignerForAccount = async (act: TAccount): Promise<ISigner | null> => {
    // Reuse the active signer when it already matches the requested account.
    if (signer && isSameAccount(account, act)) {
      return signer
    }
    // Stored accounts usually arrive as pointers. A temporary account may carry
    // its own credentials and deliberately never be added to account storage.
    const sourceAccount = storage.findAccount(act) ?? act
    try {
      const newSigner = await buildSignerForAccount(sourceAccount)
      if (!newSigner) {
        return null
      }
      // Guard against the signer resolving to a different identity (e.g. a NIP-07
      // extension currently set to another account) — never sign with the wrong key.
      const signerPubkey = await newSigner.getPublicKey()
      if (signerPubkey !== act.pubkey) {
        return null
      }
      return newSigner
    } catch {
      return null
    }
  }

  const setupNewUser = async (signer: ISigner) => {
    const defaultRelays = getDefaultRelayUrls()
    await Promise.allSettled([
      client.publishEvent(defaultRelays, await signer.signEvent(createFollowListDraftEvent([]))),
      client.publishEvent(defaultRelays, await signer.signEvent(createMuteListDraftEvent([]))),
      client.publishEvent(
        defaultRelays,
        await signer.signEvent(
          createRelayListDraftEvent(defaultRelays.map((url) => ({ url, scope: 'both' })))
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

  const publishSignedEvent = async (event: Event, options: TPublishOptions = {}) => {
    const relays = await client.determineTargetRelays(event, options)
    await client.publishEvent(relays, event)
    return event
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

    return publishSignedEvent(event, options)
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

  const nip44Encrypt = async (pubkey: string, plainText: string) => {
    return signer?.nip44Encrypt(pubkey, plainText) ?? ''
  }

  const nip44Decrypt = async (pubkey: string, cipherText: string) => {
    return signer?.nip44Decrypt(pubkey, cipherText) ?? ''
  }

  const hasEncryptionKey = () => {
    if (!account) return false
    return encryptionKeyService.hasEncryptionKey(account.pubkey)
  }

  const getEncryptionKeypair = (): TEncryptionKeypair | null => {
    if (!account) return null
    return encryptionKeyService.getEncryptionKeypair(account.pubkey)
  }

  const ensureEncryptionKey = async (): Promise<TEncryptionKeypair> => {
    if (!account || !signer) {
      throw new Error('Not logged in')
    }
    return encryptionKeyService.initializeEncryption(signer, account.pubkey)
  }

  const checkLogin = async <T,>(cb?: () => T): Promise<T | void> => {
    if (signer) {
      return cb && cb()
    }
    return setOpenLoginDialog(true)
  }

  const updateSelfEvent = async (event: Event, privateTags?: string[][]) => {
    const active = selfEventSyncRef.current
    if (!active || active.pubkey !== event.pubkey) return
    if (privateTags) {
      await indexedDb.putDecryptedContent(event.id, JSON.stringify(privateTags))
    }
    await active.sync.receive(event)
  }

  const updateRelayListEvent = (event: Event) => updateSelfEvent(event)
  const updateProfileEvent = (event: Event) => updateSelfEvent(event)
  const updateFollowListEvent = (event: Event) => updateSelfEvent(event)
  const updateMuteListEvent = (event: Event, privateTags: string[][]) =>
    updateSelfEvent(event, privateTags)
  const updateBookmarkListEvent = (event: Event) => updateSelfEvent(event)
  const updateFavoriteRelaysEvent = (event: Event) => updateSelfEvent(event)
  const updateUserEmojiListEvent = (event: Event) => updateSelfEvent(event)
  const updatePinListEvent = (event: Event) => updateSelfEvent(event)
  const updatePinnedUsersEvent = (event: Event, privateTags?: string[][]) =>
    updateSelfEvent(event, privateTags)

  const updateNotificationsSeenAt = async (skipPublish = false) => {
    if (!account) return

    const now = dayjs().unix()
    const seenAt = Math.max(now, storage.getLastReadNotificationTime(account.pubkey))
    storage.setLastReadNotificationTime(account.pubkey, seenAt)
    setNotificationsSeenAt((previous) => Math.max(previous, seenAt))

    // Prevent too frequent requests for signing seen notifications events
    const lastPublishedSeenNotificationsAtEventAt =
      lastPublishedSeenNotificationsAtEventAtMap.get(account.pubkey) ?? -1
    if (
      !skipPublish &&
      !storage.getDisableNotificationSync() &&
      (lastPublishedSeenNotificationsAtEventAt < 0 ||
        now - lastPublishedSeenNotificationsAtEventAt > 10 * 60) // 10 minutes
    ) {
      lastPublishedSeenNotificationsAtEventAtMap.set(account.pubkey, now)
      await publish(createSeenNotificationsAtDraftEvent()).catch(() => {
        // ignore
      })
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
        pinnedUsersEvent,
        notificationsSeenAt,
        account,
        accounts,
        nsec,
        ncryptsec,
        switchAccount,
        getSignerForAccount,
        getActivePrivkey,
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
        nip44Encrypt,
        nip44Decrypt,
        signer,
        hasEncryptionKey,
        getEncryptionKeypair,
        ensureEncryptionKey,
        startLogin: () => setOpenLoginDialog(true),
        checkLogin,
        signEvent,
        updateRelayListEvent,
        updateProfileEvent,
        updateFollowListEvent,
        updateMuteListEvent,
        updateBookmarkListEvent,
        updateFavoriteRelaysEvent,
        updateUserEmojiListEvent,
        updatePinListEvent,
        updatePinnedUsersEvent,
        updateNotificationsSeenAt
      }}
    >
      {children}
      <LoginDialog open={openLoginDialog} setOpen={setOpenLoginDialog} />
      <PasswordInputDialog
        open={passwordDialogOpen}
        title={t('Enter Password')}
        description={t('Enter the password to decrypt your ncryptsec')}
        onConfirm={handlePasswordConfirm}
        onCancel={handlePasswordCancel}
      />
    </NostrContext.Provider>
  )
}
