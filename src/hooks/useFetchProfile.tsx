import { userIdToPubkey } from '@/lib/pubkey'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { TProfile } from '@/types'
import { useEffect, useMemo, useState } from 'react'

export function useFetchProfile(id?: string) {
  const { profile: currentAccountProfile } = useNostr()
  const [isFetching, setIsFetching] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [profile, setProfile] = useState<TProfile | null>(null)
  const pubkey = useMemo(() => (id ? userIdToPubkey(id) : undefined), [id])

  useEffect(() => {
    const fetchProfile = async () => {
      setIsFetching(true)
      try {
        if (!id) {
          setIsFetching(false)
          setError(new Error('No id provided'))
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
