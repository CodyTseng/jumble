import { cn } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import fayan from '@/services/fayan.service'
import { ShieldAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function TrustScoreBadge({
  pubkey,
  className,
  classNames
}: {
  pubkey: string
  className?: string
  classNames?: {
    container?: string
  }
}) {
  const { t } = useTranslation()
  const { isUserTrusted } = useUserTrust()
  const { pubkey: currentPubkey } = useNostr()
  const [percentile, setPercentile] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentPubkey === pubkey) {
      setLoading(false)
      setPercentile(null)
      return
    }

    if (isUserTrusted(pubkey)) {
      setLoading(false)
      setPercentile(null)
      return
    }

    const fetchScore = async () => {
      try {
        const percentile = await fayan.fetchUserPercentile(pubkey)
        if (percentile !== null) {
          setPercentile(percentile)
        }
      } catch (error) {
        console.error('Failed to fetch trust score:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchScore()
  }, [pubkey, currentPubkey, isUserTrusted])

  if (loading || percentile === null) return null

  // percentile < 40: likely spam (red alert)
  if (percentile < 40) {
    return (
      <div
        title={t('Likely spam account (Trust score: {{percentile}}%)', { percentile })}
        className={classNames?.container}
      >
        <ShieldAlert className={cn('!size-4 text-red-500', className)} />
      </div>
    )
  }

  return null
}
