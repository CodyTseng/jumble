import { isTouchDevice } from '@/lib/utils'
import dayjs from 'dayjs'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export function FormattedTimestamp({
  timestamp,
  short = false,
  className
}: {
  timestamp: number
  short?: boolean
  className?: string
}) {
  const supportTouch = useMemo(() => isTouchDevice(), [])
  const title = supportTouch ? undefined : new Date(timestamp * 1000).toLocaleString()
  return (
    <span className={className} title={title}>
      <FormattedTimestampContent timestamp={timestamp} short={short} />
    </span>
  )
}

function FormattedTimestampContent({
  timestamp,
  short = false
}: {
  timestamp: number
  short?: boolean
}) {
  const { t } = useTranslation()
  const time = dayjs(timestamp * 1000)
  const now = dayjs()

  const diffMonth = now.diff(time, 'month')
  if (diffMonth >= 2) {
    return t('date', { timestamp: time.valueOf() })
  }

  const diffDay = now.diff(time, 'day')
  if (diffDay >= 1) {
    return short ? t('n d', { n: diffDay }) : t('day ago', { count: diffDay })
  }

  const diffHour = now.diff(time, 'hour')
  if (diffHour >= 1) {
    return short ? t('n h', { n: diffHour }) : t('hour ago', { count: diffHour })
  }

  const diffMinute = now.diff(time, 'minute')
  if (diffMinute >= 1) {
    return short ? t('n m', { n: diffMinute }) : t('minute ago', { count: diffMinute })
  }

  return t('just now')
}
