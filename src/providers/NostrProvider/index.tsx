import LoginDialog from '@/components/LoginDialog'
import { BIG_RELAY_URLS } from '@/constants'
import { useToast } from '@/hooks'
import { getProfileFromProfileEvent, getRelayListFromRelayListEvent } from '@/lib/event'
import { formatPubkey } from '@/lib/pubkey'
import client from '@/services/client.service'
import storage from '@/services/storage.service'
import { ISigner, TAccount, TAccountPointer, TDraftEvent, TProfile, TRelayList } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds, VerifiedEvent } from 'nostr-tools'
import * as nip19 from 'nostr-tools/nip19'
import * as nip49 from 'nostr-tools/nip49'
import { createContext, useContext, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BunkerSigner } from './bunker.signer'
import { Nip07Signer } from './nip-07.signer'
import { NsecSigner } from './nsec.signer'

type TNostrContext = {
  pubkey: string | null
  profile: TProfile | null
  profileEvent: Event | null
  relayList: TRelayList | null
  account: TAccountPointer | null
  accounts: TAccountPointer[]
  nsec: string | null
  ncryptsec: string | null
  switchAccount: (account: TAccountPointer | null) => Promise<void>
  nsecLogin: (nsec: string, password?: string) => Promise<string>
  ncryptsecLogin: (ncryptsec: string) => Promise<string>
  nip07Login: () => Promise<string>
  bunkerLogin: (bunker: string) => Promise<string>
  removeAccount: (account: TAccountPointer) => void
  /**
   * Default publish the event to current relays, user's write relays and additional relays
   */
  publish: (
    draftEvent: TDraftEvent,
    options?: { additionalRelayUrls?: string[]; specifiedRelayUrls?: string[] }
  ) => Promise<Event>
  signHttpAuth: (url: string, method: string) => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<Event>
  nip04Encrypt: (pubkey: string, plainText: string) => Promise<string>
  nip04Decrypt: (pubkey: string, cipherText: string) => Promise<string>
  checkLogin: <T>(cb?: () => T) => Promise<T | void>
  getRelayList: (pubkey: string) => Promise<TRelayList>
  updateRelayListEvent: (relayListEvent: Event) => void
  updateProfileEvent: (profileEvent: Event) => void
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
    setRelayList(null)
    setProfile(null)
    setProfileEvent(null)
    setNsec(null)
    if (!account) {
      return
    }

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
    const storedRelayListEvent = storage.getAccountRelayListEvent(account.pubkey)
    if (storedRelayListEvent) {
      setRelayList(
        storedRelayListEvent ? getRelayListFromRelayListEvent(storedRelayListEvent) : null
      )
    }
    const storedProfileEvent = storage.getAccountProfileEvent(account.pubkey)
    if (storedProfileEvent) {
      setProfileEvent(storedProfileEvent)
      setProfile(getProfileFromProfileEvent(storedProfileEvent))
    }
    client.fetchRelayListEvent(account.pubkey).then(async (relayListEvent) => {
      if (!relayListEvent) {
        if (storedRelayListEvent) return

        setRelayList({ write: BIG_RELAY_URLS, read: BIG_RELAY_URLS, originalRelays: [] })
        return
      }
      const isNew = storage.setAccountRelayListEvent(relayListEvent)
      if (!isNew) return
      setRelayList(getRelayListFromRelayListEvent(relayListEvent))
    })
    client.fetchProfileEvent(account.pubkey).then(async (profileEvent) => {
      if (!profileEvent) {
        if (storedProfileEvent) return

        setProfile({
          pubkey: account.pubkey,
          username: formatPubkey(account.pubkey)
        })
        return
      }
      const isNew = storage.setAccountProfileEvent(profileEvent)
      if (!isNew) return
      setProfileEvent(profileEvent)
      setProfile(getProfileFromProfileEvent(profileEvent))
    })
    client.initUserIndexFromFollowings(account.pubkey)
  }, [account])

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

  const nsecLogin = async (nsec: string, password?: string) => {
    const browserNsecSigner = new NsecSigner()
    const { type, data: privkey } = nip19.decode(nsec)
    if (type !== 'nsec') {
      throw new Error('invalid nsec')
    }
    const pubkey = browserNsecSigner.login(privkey)
    if (password) {
      const ncryptsec = nip49.encrypt(privkey, password)
      return login(browserNsecSigner, { pubkey, signerType: 'ncryptsec', ncryptsec })
    }
    return login(browserNsecSigner, { pubkey, signerType: 'nsec', nsec })
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
    {
      additionalRelayUrls,
      specifiedRelayUrls
    }: { additionalRelayUrls?: string[]; specifiedRelayUrls?: string[] } = {}
  ) => {
    const event = await signEvent(draftEvent)
    await client.publishEvent(
      specifiedRelayUrls?.length
        ? specifiedRelayUrls
        : (relayList?.write ?? [])
            .concat(additionalRelayUrls ?? [])
            .concat(client.getDefaultRelayUrls()),
      event,
      { signer: signEvent }
    )
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

  const getRelayList = async (pubkey: string) => {
    const storedRelayListEvent = storage.getAccountRelayListEvent(pubkey)
    if (storedRelayListEvent) {
      return getRelayListFromRelayListEvent(storedRelayListEvent)
    }
    return await client.fetchRelayList(pubkey)
  }

  const updateRelayListEvent = (relayListEvent: Event) => {
    const isNew = storage.setAccountRelayListEvent(relayListEvent)
    if (!isNew) return
    setRelayList(getRelayListFromRelayListEvent(relayListEvent))
  }

  const updateProfileEvent = (profileEvent: Event) => {
    const isNew = storage.setAccountProfileEvent(profileEvent)
    if (!isNew) return
    setProfileEvent(profileEvent)
    setProfile(getProfileFromProfileEvent(profileEvent))
    client.updateProfileCache(profileEvent)
  }

  return (
    <NostrContext.Provider
      value={{
        pubkey: account?.pubkey ?? null,
        profile,
        profileEvent,
        relayList,
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
        removeAccount,
        publish,
        signHttpAuth,
        nip04Encrypt,
        nip04Decrypt,
        checkLogin,
        signEvent,
        getRelayList,
        updateRelayListEvent,
        updateProfileEvent
      }}
    >
      {children}
      <LoginDialog open={openLoginDialog} setOpen={setOpenLoginDialog} />
    </NostrContext.Provider>
  )
}
