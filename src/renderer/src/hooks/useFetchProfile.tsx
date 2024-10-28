import { formatNpub } from '@renderer/lib/pubkey'
import client from '@renderer/services/client.service'
import { nip19 } from 'nostr-tools'
import { useCallback, useEffect, useMemo, useState } from 'react'

type TProfile = {
  username: string
  pubkey?: string
  npub?: `npub1${string}`
  banner?: string
  avatar?: string
  nip05?: string
  about?: string
}

const decodeUserId = (id: string): { pubkey?: string; npub?: `npub1${string}` } => {
  if (/^npub1[a-z0-9]{58}$/.test(id)) {
    const { data } = nip19.decode(id as `npub1${string}`)
    return { pubkey: data, npub: id as `npub1${string}` }
  } else if (id.startsWith('nprofile1')) {
    const { data } = nip19.decode(id as `nprofile1${string}`)
    return { pubkey: data.pubkey, npub: nip19.npubEncode(data.pubkey) }
  } else if (/^[0-9a-f]{64}$/.test(id)) {
    return { pubkey: id, npub: nip19.npubEncode(id) }
  }
  return {}
}

export function useFetchProfile(id?: string) {
  const initialProfile: TProfile = useMemo(() => {
    const profile: TProfile = {
      username: id ? (id.length > 9 ? id.slice(0, 4) + '...' + id.slice(-4) : id) : 'username'
    }
    if (!id) return profile

    const { pubkey, npub } = decodeUserId(id)
    if (!pubkey || !npub) return profile

    return {
      ...profile,
      username: formatNpub(npub),
      pubkey,
      npub
    }
  }, [id])
  const [profile, setProfile] = useState<TProfile>(initialProfile)

  const fetchProfile = useCallback(async () => {
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
        setProfile({ ...initialProfile, pubkey, npub })
        return
      }

      const profileObj = JSON.parse(profileEvent.content)
      setProfile({
        ...initialProfile,
        pubkey,
        npub,
        banner: profileObj.banner,
        avatar: profileObj.picture,
        username:
          profileObj.display_name.trim() || profileObj.name.trim() || initialProfile.username,
        nip05: profileObj.nip05,
        about: profileObj.about
      })
    } catch {
      // ignore
    }
  }, [initialProfile])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return profile
}
