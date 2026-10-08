import { useSecondaryPage } from '@/PageManager'
import { Button } from '@/components/ui/button'
import { toRelayActivity } from '@/lib/link'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useRelayObservations } from '.'
import {
  compareRelayActivityRows,
  createRelayActivityRow,
  RelayActivityColumn,
  RelayActivityRow,
  RelayActivitySort
} from './relay-activity-table'

const columns: { key: RelayActivityColumn; label: string; ascending?: boolean }[] = [
  { key: 'url', label: 'Relay' },
  { key: 'totalConnections', label: 'Total connections' },
  { key: 'date', label: 'Latest active day' },
  { key: 'connections', label: 'Connection attempts' },
  { key: 'failures', label: 'Connection failures' },
  { key: 'failureRate', label: 'Failure rate' },
  { key: 'connectionTime', label: 'Connection time', ascending: true },
  { key: 'writeTime', label: 'Write time', ascending: true },
  { key: 'readTime', label: 'First event time', ascending: true },
  { key: 'readRejections', label: 'Read rejections' },
  { key: 'readTimeouts', label: 'Read timeouts' },
  { key: 'writeRejections', label: 'Write rejections' },
  { key: 'writeTimeouts', label: 'Write timeouts' }
]

function formatValue(row: RelayActivityRow, column: RelayActivityColumn) {
  const value = row[column]
  if (value === undefined) return '—'
  if (typeof value === 'number') {
    if (column === 'failureRate') return `${(value * 100).toFixed(1)}%`
    if (column === 'connectionTime' || column === 'writeTime' || column === 'readTime') {
      return `≈ ${Math.round(value)} ms`
    }
  }
  return value
}

export default function RelayActivityList() {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const observations = useRelayObservations()
  const [limit, setLimit] = useState(50)
  const [sort, setSort] = useState<RelayActivitySort>({
    column: 'totalConnections',
    direction: 'desc'
  })
  const records = observations.list()
  const rows = records
    .map((record) => createRelayActivityRow(record.url, record))
    .sort((a, b) => compareRelayActivityRows(a, b, sort))
  const visibleRows = rows.slice(0, limit)

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        {t(
          'Table statistics show the latest active day; total connections cover all recorded days. Click a relay for details.'
        )}
      </p>
      <div className="-mx-4 overflow-x-auto">
        <table className="w-full text-sm" aria-label={t('Relay activity')}>
          <thead>
            <tr className="border-b">
              {columns.map(({ key, label, ascending }) => {
                if (key === 'url') {
                  return (
                    <th
                      key={key}
                      scope="col"
                      className="bg-background sticky start-0 z-10 py-2 ps-4 pe-2 text-start text-xs font-medium"
                    >
                      {t(label)}
                    </th>
                  )
                }
                const active = sort.column === key
                const Icon = active ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
                return (
                  <th
                    key={key}
                    scope="col"
                    aria-sort={
                      active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                    className="bg-background px-2 py-2 text-end font-medium last:pe-4"
                  >
                    <button
                      type="button"
                      className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm text-xs whitespace-nowrap focus-visible:ring-2 focus-visible:outline-none"
                      onClick={() =>
                        setSort({
                          column: key,
                          direction: active
                            ? sort.direction === 'asc'
                              ? 'desc'
                              : 'asc'
                            : ascending
                              ? 'asc'
                              : 'desc'
                        })
                      }
                    >
                      {t(label)}
                      <Icon
                        className={`size-3 shrink-0 ${active ? '' : 'text-muted-foreground'}`}
                      />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.url}
                data-clickable-card
                tabIndex={0}
                className="group hover:bg-muted focus-visible:bg-muted focus-visible:ring-ring cursor-pointer border-b last:border-b-0 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
                onClick={() => push(toRelayActivity(row.url))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    push(toRelayActivity(row.url))
                  }
                }}
                title={t('View relay details')}
              >
                {columns.map(({ key }) => (
                  <td
                    key={key}
                    className={
                      key === 'url'
                        ? 'bg-background group-hover:bg-muted group-focus-visible:bg-muted sticky start-0 z-10 py-2 ps-4 pe-2'
                        : 'px-2 py-2 text-end whitespace-nowrap tabular-nums last:pe-4'
                    }
                  >
                    {key === 'url' ? (
                      <span className="block w-36 truncate font-medium" title={row.url}>
                        {row.url.replace(/^wss?:\/\//, '')}
                      </span>
                    ) : (
                      formatValue(row, key)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={columns.length} className="text-muted-foreground p-4">
                  {t('No relay activity recorded yet')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > limit && (
        <Button variant="outline" onClick={() => setLimit(limit + 50)}>
          {t('Show more')}
        </Button>
      )}
    </div>
  )
}
