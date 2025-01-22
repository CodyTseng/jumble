import { getProfileFromProfileEvent } from '@/lib/event'
import { userIdToPubkey } from '@/lib/pubkey'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import storage from '@/services/storage.service'
import { TProfile } from '@/types'
import { useEffect, useState } from 'react'

export function useFetchProfile(id?: string) {
  const { profile: currentAccountProfile } = useNostr()
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [profile, setProfile] = useState<TProfile | null>(null)
  const [pubkey, setPubkey] = useState<string | null>(null)

  useEffect(() => {
    setProfile(null)
    setPubkey(null)
    const fetchProfile = async () => {
      setIsFetching(true)
      try {
        if (!id) {
          setIsFetching(false)
          setError(new Error('No id provided'))
          return
        }

        const pubkey = userIdToPubkey(id)
        setPubkey(pubkey)
        const storedProfileEvent = storage.getAccountProfileEvent(pubkey)
        if (storedProfileEvent) {
          const profile = getProfileFromProfileEvent(storedProfileEvent)
          setProfile(profile)
          setIsFetching(false)
          return
        }

        const profile = await client.fetchProfile(id)
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

  useEffect(() => {
    if (currentAccountProfile && pubkey === currentAccountProfile.pubkey) {
      setProfile(currentAccountProfile)
    }
  }, [currentAccountProfile])

  return { isFetching, error, profile }
}
