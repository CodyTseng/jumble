import LoginDialog from '@/components/LoginDialog'
import { BIG_RELAY_URLS, ExtendedKind } from '@/constants'
import { useToast } from '@/hooks'
import {
  getLatestEvent,
  getProfileFromProfileEvent,
  getRelayListFromRelayListEvent
} from '@/lib/event'
import { formatPubkey, isValidPubkey } from '@/lib/pubkey'
import client from '@/services/client.service'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import { ISigner, TAccount, TAccountPointer, TDraftEvent, TProfile, TRelayList } from '@/types'
import { hexToBytes } from '@noble/hashes/utils'
import dayjs from 'dayjs'
import { Event, kinds, VerifiedEvent } from 'nostr-tools'
import * as nip19 from 'nostr-tools/nip19'
import * as nip49 from 'nostr-tools/nip49'
import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BunkerSigner } from './bunker.signer'
import { Nip07Signer } from './nip-07.signer'
import { NsecSigner } from './nsec.signer'
import { NpubSigner } from './npub.signer'

type TNostrContext = {
  pubkey: string | null
  profile: TProfile | null
  profileEvent: Event | null
  relayList: TRelayList | null
  followListEvent?: Event
  muteListEvent?: Event
  favoriteRelaysEvent?: Event
  account: TAccountPointer | null
  accounts: TAccountPointer[]
  nsec: string | null
  ncryptsec: string | null
  switchAccount: (account: TAccountPointer | null) => Promise<void>
  nsecLogin: (nsec: string, password?: string) => Promise<string>
  ncryptsecLogin: (ncryptsec: string) => Promise<string>
  nip07Login: () => Promise<string>
  bunkerLogin: (bunker: string) => Promise<string>
  npubLogin(npub: string): Promise<string>
  removeAccount: (account: TAccountPointer) => void
  /**
   * Default publish the event to current relays, user's write relays and additional relays
   */
  publish: (draftEvent: TDraftEvent, options?: { specifiedRelayUrls?: string[] }) => Promise<Event>
  signHttpAuth: (url: string, method: string) => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<VerifiedEvent>
  nip04Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip04Decrypt: (pubkey: string, cipherText: string) => Promise<string>
  startLogin: () => void
  checkLogin: <T>(cb?: () => T) => Promise<T | void>
  updateRelayListEvent: (relayListEvent: Event) => Promise<void>
  updateProfileEvent: (profileEvent: Event) => Promise<void>
  updateFollowListEvent: (followListEvent: Event) => Promise<void>
  updateMuteListEvent: (muteListEvent: Event, tags: string[][]) => Promise<void>
  updateFavoriteRelaysEvent: (favoriteRelaysEvent: Event) => Promise<void>
}

const NostrContext = createContext<TNostrContext | undefined>(undefined)

export const useNostr = () => {
  const context = useContext(NostrContext)
  if (!context) {
    throw new Error('useNostr must be used within a NostrProvider')
  }
  return context
}

export function NostrProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [account, setAccount] = useState<TAccountPointer | null>(null)
  const [nsec, setNsec] = useState<string | null>(null)
  const [ncryptsec, setNcryptsec] = useState<string | null>(null)
  const [signer, setSigner] = useState<ISigner | null>(null)
  const [openLoginDialog, setOpenLoginDialog] = useState(false)
  const [profile, setProfile] = useState<TProfile | null>(null)
  const [profileEvent, setProfileEvent] = useState<Event | null>(null)
  const [relayList, setRelayList] = useState<TRelayList | null>(null)
  const [followListEvent, setFollowListEvent] = useState<Event | undefined>(undefined)
  const [muteListEvent, setMuteListEvent] = useState<Event | undefined>(undefined)
  const [favoriteRelaysEvent, setFavoriteRelaysEvent] = useState<Event | undefined>(undefined)

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
    init()

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
      const [
        storedRelayListEvent,
        storedProfileEvent,
        storedFollowListEvent,
        storedMuteListEvent,
        storedFavoriteRelaysEvent
      ] = await Promise.all([
        indexedDb.getReplaceableEvent(account.pubkey, kinds.RelayList),
        indexedDb.getReplaceableEvent(account.pubkey, kinds.Metadata),
        indexedDb.getReplaceableEvent(account.pubkey, kinds.Contacts),
        indexedDb.getReplaceableEvent(account.pubkey, kinds.Mutelist),
        indexedDb.getReplaceableEvent(account.pubkey, ExtendedKind.FAVORITE_RELAYS)
      ])
      if (storedRelayListEvent) {
        setRelayList(
          storedRelayListEvent ? getRelayListFromRelayListEvent(storedRelayListEvent) : null
        )
      }
      if (storedProfileEvent) {
        setProfileEvent(storedProfileEvent)
        setProfile(getProfileFromProfileEvent(storedProfileEvent))
      }
      if (storedFollowListEvent) {
        setFollowListEvent(storedFollowListEvent)
      }
      if (storedMuteListEvent) {
        setMuteListEvent(storedMuteListEvent)
      }
      if (storedFavoriteRelaysEvent) {
        setFavoriteRelaysEvent(storedFavoriteRelaysEvent)
      }

      const relayListEvents = await client.fetchEvents(BIG_RELAY_URLS, {
        kinds: [kinds.RelayList],
        authors: [account.pubkey]
      })
      const relayListEvent = getLatestEvent(relayListEvents) ?? storedRelayListEvent
      const relayList = getRelayListFromRelayListEvent(relayListEvent)
      if (relayListEvent) {
        client.updateRelayListCache(relayListEvent)
        await indexedDb.putReplaceableEvent(relayListEvent)
      }
      setRelayList(relayList)

      const events = await client.fetchEvents(relayList.write.concat(BIG_RELAY_URLS).slice(0, 4), {
        kinds: [kinds.Metadata, kinds.Contacts, kinds.Mutelist, ExtendedKind.FAVORITE_RELAYS],
        authors: [account.pubkey]
      })
      const sortedEvents = events.sort((a, b) => b.created_at - a.created_at)
      const profileEvent = sortedEvents.find((e) => e.kind === kinds.Metadata)
      const followListEvent = sortedEvents.find((e) => e.kind === kinds.Contacts)
      const muteListEvent = sortedEvents.find((e) => e.kind === kinds.Mutelist)
      const favoriteRelaysEvent = sortedEvents.find((e) => e.kind === ExtendedKind.FAVORITE_RELAYS)
      if (profileEvent) {
        setProfileEvent(profileEvent)
        setProfile(getProfileFromProfileEvent(profileEvent))
        await indexedDb.putReplaceableEvent(profileEvent)
      } else if (!storedProfileEvent) {
        setProfile({
          pubkey: account.pubkey,
          username: formatPubkey(account.pubkey)
        })
      }
      if (followListEvent) {
        setFollowListEvent(followListEvent)
        await indexedDb.putReplaceableEvent(followListEvent)
      }
      if (muteListEvent) {
        setMuteListEvent(muteListEvent)
        await indexedDb.putReplaceableEvent(muteListEvent)
      }
      if (favoriteRelaysEvent) {
        setFavoriteRelaysEvent(favoriteRelaysEvent)
        await indexedDb.putReplaceableEvent(favoriteRelaysEvent)
      }

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
    if (signer) {
      client.signer = signer
    } else {
      client.signer = undefined
    }
  }, [signer])

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
    storage.addAccount(act)
    storage.switchAccount(act)
    setAccount({ pubkey: act.pubkey, signerType: act.signerType })
    setSigner(signer)
    return act.pubkey
  }

  const removeAccount = (act: TAccountPointer) => {
    storage.removeAccount(act)
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

  const nsecLogin = async (nsecOrHex: string, password?: string) => {
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
      return login(nsecSigner, { pubkey, signerType: 'ncryptsec', ncryptsec })
    }
    return login(nsecSigner, { pubkey, signerType: 'nsec', nsec: nip19.nsecEncode(privkey) })
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
      toast({
        title: 'Login failed',
        description: (err as Error).message,
        variant: 'destructive'
      })
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
        const pubkey = await bunkerSigner.login(account.bunker)
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

  const signEvent = async (draftEvent: TDraftEvent) => {
    const event = await signer?.signEvent(draftEvent)
    if (!event) {
      throw new Error('sign event failed')
    }
    return event as VerifiedEvent
  }

  const publish = async (
    draftEvent: TDraftEvent,
    { specifiedRelayUrls }: { specifiedRelayUrls?: string[] } = {}
  ) => {
    const additionalRelayUrls: string[] = []
    if (
      !specifiedRelayUrls?.length &&
      [
        kinds.ShortTextNote,
        kinds.Reaction,
        kinds.Repost,
        ExtendedKind.COMMENT,
        ExtendedKind.PICTURE
      ].includes(draftEvent.kind)
    ) {
      const mentions: string[] = []
      draftEvent.tags.forEach(([tagName, tagValue]) => {
        if (
          ['p', 'P'].includes(tagName) &&
          !!tagValue &&
          isValidPubkey(tagValue) &&
          !mentions.includes(tagValue)
        ) {
          mentions.push(tagValue)
        }
      })
      if (mentions.length > 0) {
        const relayLists = await client.fetchRelayLists(mentions)
        relayLists.forEach((relayList) => {
          additionalRelayUrls.push(...relayList.read.slice(0, 4))
        })
      }
    }
    if (draftEvent.kind === kinds.RelayList) {
      additionalRelayUrls.push(...BIG_RELAY_URLS)
    }

    const event = await signEvent(draftEvent)
    const relays = specifiedRelayUrls?.length
      ? specifiedRelayUrls
      : (relayList?.write.slice(0, 10) ?? [])
          .concat(Array.from(new Set(additionalRelayUrls)) ?? [])
          .concat(client.getCurrentRelayUrls())
    if (!relays.length) {
      relays.push(...BIG_RELAY_URLS)
    }

    await client.publishEvent(relays, event)
    return event
  }

  const signHttpAuth = async (url: string, method: string) => {
    const event = await signEvent({
      content: '',
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
    setRelayList(getRelayListFromRelayListEvent(newRelayList))
  }

  const updateProfileEvent = async (profileEvent: Event) => {
    const newProfileEvent = await indexedDb.putReplaceableEvent(profileEvent)
    setProfileEvent(newProfileEvent)
    setProfile(getProfileFromProfileEvent(newProfileEvent))
  }

  const updateFollowListEvent = async (followListEvent: Event) => {
    const newFollowListEvent = await indexedDb.putReplaceableEvent(followListEvent)
    if (newFollowListEvent.id !== followListEvent.id) return

    setFollowListEvent(newFollowListEvent)
    client.updateFollowListCache(newFollowListEvent)
  }

  const updateMuteListEvent = async (muteListEvent: Event, tags: string[][]) => {
    const newMuteListEvent = await indexedDb.putReplaceableEvent(muteListEvent)
    if (newMuteListEvent.id !== muteListEvent.id) return

    await indexedDb.putMuteDecryptedTags(muteListEvent.id, tags)
    setMuteListEvent(muteListEvent)
  }

  const updateFavoriteRelaysEvent = async (favoriteRelaysEvent: Event) => {
    const newFavoriteRelaysEvent = await indexedDb.putReplaceableEvent(favoriteRelaysEvent)
    if (newFavoriteRelaysEvent.id !== favoriteRelaysEvent.id) return

    setFavoriteRelaysEvent(newFavoriteRelaysEvent)
  }

  return (
    <NostrContext.Provider
      value={{
        pubkey: account?.pubkey ?? null,
        profile,
        profileEvent,
        relayList,
        followListEvent,
        muteListEvent,
        favoriteRelaysEvent,
        account,
        accounts: storage
          .getAccounts()
          .map((act) => ({ pubkey: act.pubkey, signerType: act.signerType })),
        nsec,
        ncryptsec,
        switchAccount,
        nsecLogin,
        ncryptsecLogin,
        nip07Login,
        bunkerLogin,
        npubLogin,
        removeAccount,
        publish,
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
        updateFavoriteRelaysEvent
      }}
    >
      {children}
      <LoginDialog open={openLoginDialog} setOpen={setOpenLoginDialog} />
    </NostrContext.Provider>
  )
}
