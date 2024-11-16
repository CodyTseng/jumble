import { TDraftEvent } from '@common/types'
import LoginDialog from '@renderer/components/LoginDialog'
import { useToast } from '@renderer/hooks'
import { useFetchRelayList } from '@renderer/hooks/useFetchRelayList'
import { IS_ELECTRON, isElectron } from '@renderer/lib/env'
import client from '@renderer/services/client.service'
import dayjs from 'dayjs'
import { Event, kinds } from 'nostr-tools'
import { createContext, useContext, useEffect, useState } from 'react'

type TNostrContext = {
  pubkey: string | null
  canLogin: boolean
  login: (nsec: string) => Promise<string>
  logout: () => Promise<void>
  nip07Login: () => Promise<string>
  /**
   * Default publish the event to current relays, user's write relays and additional relays
   */
  publish: (draftEvent: TDraftEvent, additionalRelayUrls?: string[]) => Promise<Event>
  signHttpAuth: (url: string, method: string) => Promise<string>
  checkLogin: (cb?: () => void | Promise<void>) => void
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
  const [canLogin, setCanLogin] = useState(false)
  const [openLoginDialog, setOpenLoginDialog] = useState(false)
  const relayList = useFetchRelayList(pubkey)

  useEffect(() => {
    window.nostr?.getPublicKey().then((pubkey) => {
      if (pubkey) {
        setPubkey(pubkey)
      }
    })
    if (isElectron(window)) {
      window.api?.system.isEncryptionAvailable().then((isEncryptionAvailable) => {
        setCanLogin(isEncryptionAvailable)
      })
    } else {
      setCanLogin(!!window.nostr)
    }
  }, [])

  const login = async (nsec: string) => {
    if (!canLogin) {
      throw new Error('encryption is not available')
    }
    if (!isElectron(window)) {
      throw new Error('login is not available')
    }
    const { pubkey, reason } = await window.api.nostr.login(nsec)
    if (!pubkey) {
      throw new Error(reason ?? 'invalid nsec')
    }
    setPubkey(pubkey)
    return pubkey
  }

  const nip07Login = async () => {
    if (IS_ELECTRON) {
      throw new Error('electron app should not use nip07 login')
    }

    if (!window.nostr) {
      throw new Error(
        'You need to install a nostr signer extension to login. Such as Alby or nos2x'
      )
    }

    const pubkey = await window.nostr.getPublicKey()
    if (!pubkey) {
      throw new Error('You did not allow to access your pubkey')
    }
    setPubkey(pubkey)
    return pubkey
  }

  const logout = async () => {
    if (isElectron(window)) {
      await window.api.nostr.logout()
    }
    setPubkey(null)
  }

  const publish = async (draftEvent: TDraftEvent, additionalRelayUrls: string[] = []) => {
    const event = await window.nostr?.signEvent(draftEvent)
    if (!event) {
      throw new Error('sign event failed')
    }
    await client.publishEvent(relayList.write.concat(additionalRelayUrls), event)
    return event
  }

  const signHttpAuth = async (url: string, method: string) => {
    const event = await window.nostr?.signEvent({
      content: '',
      kind: kinds.HTTPAuth,
      created_at: dayjs().unix(),
      tags: [
        ['u', url],
        ['method', method]
      ]
    })
    if (!event) {
      throw new Error('sign event failed')
    }
    return 'Nostr ' + btoa(JSON.stringify(event))
  }

  const checkLogin = async (cb?: () => void) => {
    if (pubkey) {
      return cb && cb()
    }
    if (IS_ELECTRON) {
      return setOpenLoginDialog(true)
    }
    try {
      await nip07Login()
    } catch (err) {
      toast({
        title: 'Login failed',
        description: (err as Error).message,
        variant: 'destructive'
      })
      return
    }
    return cb && cb()
  }

  return (
    <NostrContext.Provider
      value={{ pubkey, canLogin, login, nip07Login, logout, publish, signHttpAuth, checkLogin }}
    >
      {children}
      <LoginDialog open={openLoginDialog} setOpen={setOpenLoginDialog} />
    </NostrContext.Provider>
  )
}
