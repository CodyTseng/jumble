import LoginDialog from '@/components/LoginDialog'
import { BIG_RELAY_URLS } from '@/constants'
import { useToast } from '@/hooks'
import {
  getFollowingsFromFollowListEvent,
  getProfileFromProfileEvent,
  getRelayListFromRelayListEvent
} from '@/lib/event'
import { formatPubkey } from '@/lib/pubkey'
import client from '@/services/client.service'
import storage from '@/services/storage.service'
import { ISigner, TAccount, TAccountPointer, TDraftEvent, TProfile, TRelayList } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
import { BunkerSigner } from './bunker.signer'
import { Nip07Signer } from './nip-07.signer'
import { NsecSigner } from './nsec.signer'

type TNostrContext = {
  pubkey: string | null
  profile: TProfile | null
  profileEvent: Event | null
  relayList: TRelayList | null
  followings: string[] | null
  account: TAccountPointer | null
  accounts: TAccountPointer[]
  nsec: string | null
  switchAccount: (account: TAccountPointer | null) => Promise<void>
  nsecLogin: (nsec: string) => Promise<string>
  nip07Login: () => Promise<string>
  bunkerLogin: (bunker: string) => Promise<string>
  removeAccount: (account: TAccountPointer) => void
  /**
   * Default publish the event to current relays, user's write relays and additional relays
   */
  publish: (draftEvent: TDraftEvent, additionalRelayUrls?: string[]) => Promise<Event>
  signHttpAuth: (url: string, method: string) => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<Event>
  checkLogin: <T>(cb?: () => T) => Promise<T | void>
  getRelayList: (pubkey: string) => Promise<TRelayList>
  updateRelayListEvent: (relayListEvent: Event) => void
  getFollowings: (pubkey: string) => Promise<string[]>
  updateFollowListEvent: (followListEvent: Event) => void
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
  const { toast } = useToast()
  const [account, setAccount] = useState<TAccountPointer | null>(null)
  const [nsec, setNsec] = useState<string | null>(null)
  const [signer, setSigner] = useState<ISigner | null>(null)
  const [openLoginDialog, setOpenLoginDialog] = useState(false)
  const [profile, setProfile] = useState<TProfile | null>(null)
  const [profileEvent, setProfileEvent] = useState<Event | null>(null)
  const [relayList, setRelayList] = useState<TRelayList | null>(null)
  const [followings, setFollowings] = useState<string[] | null>(null)

  useEffect(() => {
    const init = async () => {
      const accounts = storage.getAccounts()
      const act = storage.getCurrentAccount() ?? accounts[0] // auto login the first account
      if (!act) return

      await loginWithAccountPointer(act)
    }
    init()
  }, [])

  useEffect(() => {
    setRelayList(null)
    setFollowings(null)
    setProfile(null)
    setProfileEvent(null)
    setNsec(null)
    if (!account) {
      return
    }

    const storedNsec = storage.getAccountNsec(account.pubkey)
    if (storedNsec) {
      setNsec(storedNsec)
    }
    const storedRelayListEvent = storage.getAccountRelayListEvent(account.pubkey)
    if (storedRelayListEvent) {
      setRelayList(
        storedRelayListEvent ? getRelayListFromRelayListEvent(storedRelayListEvent) : null
      )
    }
    const storedFollowListEvent = storage.getAccountFollowListEvent(account.pubkey)
    if (storedFollowListEvent) {
      setFollowings(getFollowingsFromFollowListEvent(storedFollowListEvent))
    }
    const storedProfileEvent = storage.getAccountProfileEvent(account.pubkey)
    if (storedProfileEvent) {
      setProfileEvent(storedProfileEvent)
      setProfile(getProfileFromProfileEvent(storedProfileEvent))
    }
    client.fetchRelayListEvent(account.pubkey).then(async (relayListEvent) => {
      if (!relayListEvent) {
        if (storedRelayListEvent) return

        setRelayList({ write: BIG_RELAY_URLS, read: BIG_RELAY_URLS })
        return
      }
      const isNew = storage.setAccountRelayListEvent(relayListEvent)
      if (!isNew) return
      setRelayList(getRelayListFromRelayListEvent(relayListEvent))
    })
    client.fetchFollowListEvent(account.pubkey).then(async (followListEvent) => {
      if (!followListEvent) {
        if (storedFollowListEvent) return

        setFollowings([])
        return
      }
      const isNew = storage.setAccountFollowListEvent(followListEvent)
      if (!isNew) return
      setFollowings(getFollowingsFromFollowListEvent(followListEvent))
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
  }, [account])

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

  const nsecLogin = async (nsec: string) => {
    const browserNsecSigner = new NsecSigner()
    const pubkey = browserNsecSigner.login(nsec)
    return login(browserNsecSigner, { pubkey, signerType: 'nsec', nsec })
  }

  const nip07Login = async () => {
    try {
      const nip07Signer = new Nip07Signer()
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
    } else if (account.signerType === 'nip-07') {
      const nip07Signer = new Nip07Signer()
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
    return event
  }

  const publish = async (draftEvent: TDraftEvent, additionalRelayUrls: string[] = []) => {
    const event = await signEvent(draftEvent)
    await client.publishEvent((relayList?.write ?? []).concat(additionalRelayUrls), event)
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

  const getFollowings = async (pubkey: string) => {
    const followListEvent = storage.getAccountFollowListEvent(pubkey)
    if (followListEvent) {
      return getFollowingsFromFollowListEvent(followListEvent)
    }
    return await client.fetchFollowings(pubkey)
  }

  const updateFollowListEvent = (followListEvent: Event) => {
    const isNew = storage.setAccountFollowListEvent(followListEvent)
    if (!isNew) return
    setFollowings(getFollowingsFromFollowListEvent(followListEvent))
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
        followings,
        account,
        accounts: storage
          .getAccounts()
          .map((act) => ({ pubkey: act.pubkey, signerType: act.signerType })),
        nsec,
        switchAccount,
        nsecLogin,
        nip07Login,
        bunkerLogin,
        removeAccount,
        publish,
        signHttpAuth,
        checkLogin,
        signEvent,
        getRelayList,
        updateRelayListEvent,
        getFollowings,
        updateFollowListEvent,
        updateProfileEvent
      }}
    >
      {children}
      <LoginDialog open={openLoginDialog} setOpen={setOpenLoginDialog} />
    </NostrContext.Provider>
  )
}
