import { formatNpub } from '@renderer/lib/pubkey'
import { nip19 } from 'nostr-tools'
import { useEffect, useState } from 'react'

type TProfile =
  | {
      username: string
      hasProfile: false
      pubkey?: string
      npub?: `npub1${string}`
      banner?: string
      avatar?: string
      nip05?: string
      about?: string
    }
  | {
      username: string
      hasProfile: true
      pubkey: string
      npub: `npub1${string}`
      banner?: string
      avatar?: string
      nip05?: string
      about?: string
    }

export function useFetchProfile(id?: string) {
  const [profile, setProfile] = useState<TProfile>({ username: 'username', hasProfile: false })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!id) {
          return
        }

        const profile: TProfile = {
          username: id.length > 9 ? id.slice(0, 4) + '...' + id.slice(-4) : id,
          hasProfile: false
        }
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
        if (!pubkey || !npub) return

        profile.username = formatNpub(npub)
        const [profileEvent] = await window.api.relay.fetchEvents([
          {
            authors: [pubkey],
            kinds: [0],
            limit: 1
          }
        ])
        if (!profileEvent) {
          setProfile({ ...profile, pubkey, npub })
          return
        }

        const profileObj = JSON.parse(profileEvent.content)
        setProfile({
          ...profile,
          hasProfile: true,
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
