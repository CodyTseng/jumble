import LoginDialog from '@/components/LoginDialog'
import { useToast } from '@/hooks'
import { useFetchRelayList } from '@/hooks/useFetchRelayList'
import client from '@/services/client.service'
import storage from '@/services/storage.service'
import { ISigner, TAccount, TDraftEvent, TSimpleAccount } from '@/types'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
import { useRelaySettings } from '../RelaySettingsProvider'
import { BunkerSigner } from './bunker.signer'
import { Nip07Signer } from './nip-07.signer'
import { NsecSigner } from './nsec.signer'

type TNostrContext = {
  pubkey: string | null
  account: TSimpleAccount | null
  accounts: TSimpleAccount[]
  switchAccount: (account: TAccount | null) => Promise<void>
  nsecLogin: (nsec: string) => Promise<string>
  nip07Login: () => Promise<string>
  bunkerLogin: (bunker: string) => Promise<string>
  removeAccount: (account: TSimpleAccount) => void
  /**
   * Default publish the event to current relays, user's write relays and additional relays
   */
  publish: (draftEvent: TDraftEvent, additionalRelayUrls?: string[]) => Promise<Event>
  signHttpAuth: (url: string, method: string) => Promise<string>
  signEvent: (draftEvent: TDraftEvent) => Promise<Event>
  checkLogin: <T>(cb?: () => T) => Promise<T | void>
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
  const [account, setAccount] = useState<TSimpleAccount | null>(null)
  const [signer, setSigner] = useState<ISigner | null>(null)
  const [openLoginDialog, setOpenLoginDialog] = useState(false)
  const { relayUrls: currentRelayUrls } = useRelaySettings()
  const relayList = useFetchRelayList(account?.pubkey)

  useEffect(() => {
    const init = async () => {
      const act = storage.getCurrentAccount()
      if (!act) return

      setAccount({ pubkey: act.pubkey, signerType: act.signerType })

      const createSignerResult = await createSigner(act)
      if (!createSignerResult) {
        storage.removeAccount(act)
        setAccount(null)
        return
      }
      login(createSignerResult.signer, createSignerResult.account)
    }
    init().catch(() => {
      setAccount(null)
    })
  }, [])

  const login = (signer: ISigner, act: TAccount) => {
    storage.addAccount(act)
    storage.switchAccount(act)
    setAccount({ pubkey: act.pubkey, signerType: act.signerType })
    setSigner(signer)
    return act.pubkey
  }

  const removeAccount = (act: TSimpleAccount) => {
    storage.removeAccount(act)
    if (account?.pubkey === act.pubkey) {
      setAccount(null)
      setSigner(null)
    }
  }

  const switchAccount = async (act: TAccount | null) => {
    if (!act) {
      storage.switchAccount(null)
      setAccount(null)
      return
    }
    const createSignerResult = await createSigner(act)
    if (!createSignerResult) return

    login(createSignerResult.signer, createSignerResult.account)
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

  const createSigner = async (
    act: TSimpleAccount
  ): Promise<{ signer: ISigner; account: TAccount } | null> => {
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
        return { signer: browserNsecSigner, account }
      }
    } else if (account.signerType === 'nip-07') {
      const nip07Signer = new Nip07Signer()
      const pubkey = await nip07Signer.getPublicKey()
      if (!pubkey) {
        storage.removeAccount(account)
        return null
      }
      if (pubkey !== account.pubkey) {
        storage.removeAccount(account)
        account = { ...account, pubkey }
        storage.addAccount(account)
      }
      return { signer: nip07Signer, account }
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
        return { signer: bunkerSigner, account }
      }
    }
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
    await client.publishEvent(
      relayList.write.concat(additionalRelayUrls).concat(currentRelayUrls),
      event
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

  const checkLogin = async <T,>(cb?: () => T): Promise<T | void> => {
    if (signer) {
      return cb && cb()
    }
    return setOpenLoginDialog(true)
  }

  return (
    <NostrContext.Provider
      value={{
        pubkey: account?.pubkey ?? null,
        account,
        accounts: storage.getSimpleAccounts(),
        switchAccount,
        nsecLogin,
        nip07Login,
        bunkerLogin,
        removeAccount,
        publish,
        signHttpAuth,
        checkLogin,
        signEvent
      }}
    >
      {children}
      <LoginDialog open={openLoginDialog} setOpen={setOpenLoginDialog} />
    </NostrContext.Provider>
  )
}
