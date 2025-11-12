import { userIdToPubkey } from '@/lib/pubkey'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
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
  }, [currentAccountProfile, pubkey])

  return { isFetching, error, profile }
}
