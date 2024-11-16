import { formatPubkey } from '@renderer/lib/pubkey'
import client from '@renderer/services/client.service'
import { TProfile } from '@renderer/types'
import { nip19 } from 'nostr-tools'
import { useEffect, useState } from 'react'

export function useFetchProfile(id?: string) {
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [profile, setProfile] = useState<TProfile>({
    username: id ? (id.length > 9 ? id.slice(0, 4) + '...' + id.slice(-4) : id) : 'username'
  })

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!id) {
          setIsFetching(false)
          setError(new Error('No id provided'))
          return
        }

        let pubkey: string | undefined

        if (/^[0-9a-f]{64}$/.test(id)) {
          pubkey = id
        } else {
          const { data, type } = nip19.decode(id)
          switch (type) {
            case 'npub':
              pubkey = data
              break
            case 'nprofile':
              pubkey = data.pubkey
              break
          }
        }

        if (!pubkey) {
          setIsFetching(false)
          setError(new Error('Invalid id'))
          return
        }
        setProfile({ pubkey, username: formatPubkey(pubkey) })

        const profile = await client.fetchProfile(pubkey)
        if (profile) {
          setProfile(profile)
        }
      } catch (err) {
        setError(err as Error)
      } finally {
        setIsFetching(false)
      }
    }

    fetchProfile()
  }, [id])

  return { isFetching, error, profile }
}
