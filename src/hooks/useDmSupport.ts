import { useUserPreferences } from '@/providers/UserPreferencesProvider'
import dmService from '@/services/dm.service'
import { useEffect, useState } from 'react'

export function useDmSupport(pubkey: string | undefined) {
  const { enableDm } = useUserPreferences()
  const [canStartDm, setCanStartDm] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!enableDm || !pubkey) {
      setCanStartDm(false)
      setIsLoading(false)
      return
    }

    const checkSupport = async () => {
      setIsLoading(true)
      try {
        const { hasDmRelays, hasEncryptionKey } = await dmService.checkDmSupport(pubkey)
        setCanStartDm(hasDmRelays && hasEncryptionKey)
      } catch {
        setCanStartDm(false)
      } finally {
        setIsLoading(false)
      }
    }

    checkSupport()
  }, [enableDm, pubkey])

  return { canStartDm, isLoading }
}
