import { formatAmount } from '@/lib/lightning'
import lightning, { TRecentSupporter } from '@/services/lightning.service'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../UserAvatar'
import Username from '../Username'

export default function RecentSupporters() {
  const { t } = useTranslation()
  const [supporters, setSupporters] = useState<TRecentSupporter[]>([])

  useEffect(() => {
    const init = async () => {
      const items = await lightning.fetchRecentSupporters()
      setSupporters(items)
    }
    init()
  }, [])

  if (!supporters.length) return null

  return (
    <div className="space-y-2">
      <div className="font-semibold text-center">{t('Recent Supporters')}</div>
      <div className="flex flex-col gap-2">
        {supporters.map((item, index) => (
          <div
            key={index}
            className="flex items-center justify-between rounded-md border p-2 sm:p-4 gap-2"
          >
            <div className="flex items-center gap-2 flex-1 w-0">
              <UserAvatar userId={item.pubkey} />
              <div className="flex-1 w-0">
                <Username className="font-semibold w-fit" userId={item.pubkey} />
                <div className="text-xs text-muted-foreground line-clamp-3 select-text">
                  {item.comment}
                </div>
              </div>
            </div>
            <div className="font-semibold text-yellow-400 shrink-0">
              {formatAmount(item.amount)} {t('sats')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
