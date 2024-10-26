import dayjs from 'dayjs'

export function formatTimestamp(timestamp: number) {
  const time = dayjs(timestamp * 1000)
  const now = dayjs()

  const diffMonth = now.diff(time, 'month')
  if (diffMonth >= 1) {
    return time.format('MMM D, YYYY')
  }

  const diffDay = now.diff(time, 'day')
  if (diffDay >= 1) {
    return `${diffDay} days ago`
  }

  const diffHour = now.diff(time, 'hour')
  if (diffHour >= 1) {
    return `${diffHour} hours ago`
  }

  const diffMinute = now.diff(time, 'minute')
  if (diffMinute >= 1) {
    return `${diffMinute} minutes ago`
  }

  return 'just now'
}
