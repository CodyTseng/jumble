import { SPECIAL_TRUST_SCORE_FILTER_ID } from '@/constants'
import { isAndroid } from '@/lib/platform'
import { getDefaultRelayUrls } from '@/lib/relay'
import { useMuteList } from '@/providers/MuteListProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { useContentPolicy } from '@/providers/ContentPolicyProvider'
import client from '@/services/client.service'
import storage from '@/services/local-storage.service'
import lightning from '@/services/lightning.service'
import { registerPlugin } from '@capacitor/core'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { t } from 'i18next'

const RelayNotifications = registerPlugin<{
  configure(options: {
    config: Record<string, unknown>
    userInitiated: boolean
  }): Promise<{ running: boolean }>
  stop(): Promise<void>
}>('JumbleRelayNotifications')

/** Only public account/filter data is sent to the native, signature-verifying relay listener. */
export function useNativeRelayNotifications(
  pubkey: string | null | undefined,
  filters: Set<string>,
  descriptions: Record<string, string>
) {
  const { mutePubkeySet } = useMuteList()
  const { getTrustedPubkeys, getMinTrustScore } = useUserTrust()
  const { hideContentMentioningMutedUsers } = useContentPolicy()
  const activation = useRef(0)
  const refreshLatest = useRef<(() => void) | null>(null)
  const latest = useRef({
    mutePubkeySet,
    getTrustedPubkeys,
    getMinTrustScore,
    hideContentMentioningMutedUsers,
    filters,
    descriptions
  })
  latest.current = {
    mutePubkeySet,
    getTrustedPubkeys,
    getMinTrustScore,
    hideContentMentioningMutedUsers,
    filters,
    descriptions
  }
  useEffect(() => {
    if (!isAndroid()) return
    let disposed = false,
      generation = 0
    let cached = { relays: getDefaultRelayUrls(), issuer: '' }
    const refresh = async (userInitiated = false) => {
      const request = ++generation
      if (!pubkey || !storage.getSystemNotificationsEnabled()) {
        activation.current = 0
        await RelayNotifications.stop()
        return
      }
      if (!activation.current) activation.current = Math.floor(Date.now() / 1000)
      try {
        const configure = async () => {
          if (disposed || request !== generation) return
          const value = latest.current
          const relays = cached.relays
          const { running } = await RelayNotifications.configure({
            userInitiated,
            config: {
              pubkey,
              relays,
              enabledAt: activation.current,
              filters: Array.from(value.filters),
              descriptions: value.descriptions,
              muted: Array.from(value.mutePubkeySet),
              trusted: value.getTrustedPubkeys(),
              minTrustScore: value.getMinTrustScore(SPECIAL_TRUST_SCORE_FILTER_ID.NOTIFICATIONS),
              hideMutedMentions: value.hideContentMentioningMutedUsers,
              zapIssuer: cached.issuer
            }
          })
          if (!running && !disposed && request === generation)
            storage.setSystemNotificationsEnabled(false)
        }
        await configure()
        if (disposed || request !== generation || !storage.getSystemNotificationsEnabled()) return
        const [relayList, issuer] = await Promise.all([
          bounded(
            client.fetchRelayList(pubkey).then((list) => ({ read: list.read })),
            { read: cached.relays }
          ),
          bounded(lightning.getReceiptIssuer(pubkey), cached.issuer)
        ])
        if (disposed || request !== generation) return
        cached = {
          relays: Array.from(new Set([...relayList.read, ...getDefaultRelayUrls()]))
            .filter((url) => url.startsWith('wss://'))
            .slice(0, 8),
          issuer: issuer ?? ''
        }
        await configure()
      } catch (error) {
        if (disposed || request !== generation) return
        console.error('[native] local notifications failed:', error)
        storage.setSystemNotificationsEnabled(false)
        toast.error(t('Something went wrong'))
      }
    }
    const changed = () => {
      void refresh(true)
    }
    refreshLatest.current = () => {
      void refresh()
    }
    window.addEventListener('system-notification-settings-change', changed)
    void refresh()
    const timer = setInterval(() => {
      void refresh()
    }, 60_000)
    return () => {
      disposed = true
      refreshLatest.current = null
      generation++
      clearInterval(timer)
      window.removeEventListener('system-notification-settings-change', changed)
      void RelayNotifications.stop().catch(console.error)
    }
  }, [pubkey])
  useEffect(() => {
    refreshLatest.current?.()
  }, [mutePubkeySet, filters, descriptions, getMinTrustScore, hideContentMentioningMutedUsers])
}

async function bounded<T>(task: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      task.catch(() => fallback),
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), 5000)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}
