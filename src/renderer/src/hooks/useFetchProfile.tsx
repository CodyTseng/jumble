import { formatNpub } from '@renderer/lib/pubkey'
import { nip19 } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import client from '@renderer/services/client.service'

type TProfile = {
  username: string
  pubkey?: string
  npub?: `npub1${string}`
  banner?: string
  avatar?: string
  nip05?: string
  about?: string
}

export function useFetchProfile(id?: string) {
  const initialProfile: TProfile = useMemo(() => {
    const profile: TProfile = {
      username: id ? (id.length > 9 ? id.slice(0, 4) + '...' + id.slice(-4) : id) : 'username'
    }
    if (!id) return profile

    let pubkey: string | undefined
    let npub: `npub1${string}` | undefined
    if (/^npub1[a-z0-9]{58}$/.test(id)) {
      const { data } = nip19.decode(id as `npub1${string}`)
      pubkey = data
      npub = id as `npub1${string}`
    } else if (id.startsWith('nprofile1')) {
      const { data } = nip19.decode(id as `nprofile1${string}`)
      pubkey = data.pubkey
      npub = nip19.npubEncode(pubkey)
    } else if (/^[0-9a-f]{64}$/.test(id)) {
      pubkey = id
      npub = nip19.npubEncode(id)
    }
    if (!pubkey || !npub) return profile

    return {
      ...profile,
      username: formatNpub(npub),
      pubkey,
      npub
    }
  }, [id])
  const [profile, setProfile] = useState<TProfile>(initialProfile)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { pubkey, npub } = initialProfile
        if (!pubkey || !npub) {
          return
        }

        const profileEvent = await client.fetchEventWithCache({
          authors: [pubkey],
          kinds: [0]
        })
        if (!profileEvent) {
          setProfile({ ...profile, pubkey, npub })
          return
        }

        const profileObj = JSON.parse(profileEvent.content)
        setProfile({
          ...profile,
          pubkey,
          npub,
          banner: profileObj.banner,
          avatar: profileObj.picture,
          username: profileObj.display_name || profileObj.name || profile.username,
          nip05: profileObj.nip05,
          about: profileObj.about
        })
      } catch {
        // ignore
      }
    }

    fetchProfile()
  }, [id])

  return profile
}
