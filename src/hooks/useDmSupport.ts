import dmRelayService from '@/services/dm-relay.service'
import { useEffect, useState } from 'react'

export function useDmSupport(pubkey: string | undefined) {
  const [canStartDm, setCanStartDm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!pubkey) {
      setCanStartDm(false)
      setIsLoading(false)
      return
    }

    const checkSupport = async () => {
      setIsLoading(true)
      try {
        const { hasDmRelays, hasEncryptionKey } = await dmRelayService.checkDmSupport(pubkey)
        setCanStartDm(hasDmRelays && hasEncryptionKey)
      } catch {
        setCanStartDm(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkSupport()
  }, [pubkey])

  return { canStartDm, isLoading }
}
