import { ISigner, TDraftEvent } from '@common/types'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils'
import LoginDialog from '@renderer/components/LoginDialog'
import { useToast } from '@renderer/hooks'
import { useFetchRelayList } from '@renderer/hooks/useFetchRelayList'
import { isElectron } from '@renderer/lib/env'
import client from '@renderer/services/client.service'
import storage from '@renderer/services/storage.service'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'
import { useRelaySettings } from '../RelaySettingsProvider'
import { BrowserNsecSigner } from './browser-nsec.signer'
import { BunkerSigner } from './bunker.signer'
import { Nip07Signer } from './nip-07.signer'
import { NsecSigner } from './nsec.signer'

type TNostrContext = {
  pubkey: string | null
  setPubkey: (pubkey: string) => void
  nsecLogin: (nsec: string) => Promise<string>
  nip07Login: () => Promise<void>
  bunkerLogin: (bunker: string) => Promise<string>
  logout: () => Promise<void>
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
  const [pubkey, setPubkey] = useState<string | null>(null)
  const [signer, setSigner] = useState<ISigner | null>(null)
  const [openLoginDialog, setOpenLoginDialog] = useState(false)
  const { relayUrls: currentRelayUrls } = useRelaySettings()
  const relayList = useFetchRelayList(pubkey)

  useEffect(() => {
    const init = async () => {
      const [account] = await storage.getAccounts()
      if (!account) {
        if (isElectron(window) || !window.nostr) {
          return
        }

        // For browser env, attempt to login with nip-07
        const nip07Signer = new Nip07Signer()
        const pubkey = await nip07Signer.getPublicKey()
        if (!pubkey) {
          return
        }
        setPubkey(pubkey)
        setSigner(nip07Signer)
        return await storage.setAccounts([{ pubkey, signerType: 'nip-07' }])
      }

      if (account.pubkey) {
        setPubkey(account.pubkey)
      }

      if (account.signerType === 'nsec') {
        const nsecSigner = new NsecSigner()
        const pubkey = await nsecSigner.getPublicKey()
        if (!pubkey) {
          setPubkey(null)
          await storage.setAccounts([])
          return
        }
        setPubkey(pubkey)
        setSigner(nsecSigner)
        return
      }

      if (account.signerType === 'browser-nsec') {
        if (!account.nsec) {
          setPubkey(null)
          await storage.setAccounts([])
          return
        }
        const browserNsecSigner = new BrowserNsecSigner()
        const pubkey = browserNsecSigner.login(account.nsec)
        setPubkey(pubkey)
        setSigner(browserNsecSigner)
        return
      }

      if (account.signerType === 'nip-07') {
        const nip07Signer = new Nip07Signer()
        const pubkey = await nip07Signer.getPublicKey()
        if (!pubkey) {
          setPubkey(null)
          await storage.setAccounts([])
          return
        }
        setPubkey(pubkey)
        setSigner(nip07Signer)
        return
      }

      if (account.signerType === 'bunker') {
        if (!account.bunker || !account.bunkerClientSecretKey) {
          setPubkey(null)
          await storage.setAccounts([])
          return
        }
        const bunkerSigner = new BunkerSigner(hexToBytes(account.bunkerClientSecretKey))
        const pubkey = await bunkerSigner.login(account.bunker)
        setPubkey(pubkey)
        setSigner(bunkerSigner)
        return
      }

      await storage.setAccounts([])
      return
    }
    init().catch(() => {
      setPubkey(null)
      storage.setAccounts([])
    })
  }, [])

  const nsecLogin = async (nsec: string) => {
    if (isElectron(window)) {
      const nsecSigner = new NsecSigner()
      const { pubkey, reason } = await nsecSigner.login(nsec)
      if (!pubkey) {
        throw new Error(reason ?? 'invalid nsec')
      }
      await storage.setAccounts([{ pubkey, signerType: 'nsec' }])
      setPubkey(pubkey)
      setSigner(nsecSigner)
      return pubkey
    }
    const browserNsecSigner = new BrowserNsecSigner()
    const pubkey = browserNsecSigner.login(nsec)
    await storage.setAccounts([{ pubkey, signerType: 'browser-nsec', nsec }])
    setPubkey(pubkey)
    setSigner(browserNsecSigner)
    return pubkey
  }

  const nip07Login = async () => {
    try {
      const nip07Signer = new Nip07Signer()
      const pubkey = await nip07Signer.getPublicKey()
      if (!pubkey) {
        throw new Error('You did not allow to access your pubkey')
      }
      await storage.setAccounts([{ pubkey, signerType: 'nip-07' }])
      setPubkey(pubkey)
      setSigner(nip07Signer)
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
    await storage.setAccounts([
      {
        pubkey,
        signerType: 'bunker',
        bunker: bunkerUrl.toString(),
        bunkerClientSecretKey: bytesToHex(bunkerSigner.clientSecretKey)
      }
    ])
    setPubkey(pubkey)
    setSigner(bunkerSigner)
    return pubkey
  }

  const logout = async () => {
    if (signer instanceof NsecSigner) {
      await signer.logout()
    } else if (signer instanceof BrowserNsecSigner) {
      signer.logout()
    }
    setPubkey(null)
    await storage.setAccounts([])
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
        pubkey,
        setPubkey,
        nsecLogin,
        nip07Login,
        bunkerLogin,
        logout,
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
