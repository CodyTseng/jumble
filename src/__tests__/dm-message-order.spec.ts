import {
  getDmMessageCreatedAt,
  nextDmRumorTimestamp,
  withDmMessageOrderTag
} from '@/lib/dm-message-order'
import { describe, expect, it } from 'vitest'

describe('DM message ordering', () => {
  it('allocates monotonic milliseconds without incrementing created_at per message', () => {
    const first = nextDmRumorTimestamp(2_000_000_000_123)
    const second = nextDmRumorTimestamp(2_000_000_000_123)

    expect(first).toEqual({ createdAt: 2_000_000_000, millisecond: 123 })
    expect(second).toEqual({ createdAt: 2_000_000_000, millisecond: 124 })
  })

  it('keeps the tag consistent when a burst crosses a second boundary', () => {
    const first = nextDmRumorTimestamp(2_000_000_001_999)
    const second = nextDmRumorTimestamp(2_000_000_001_999)

    expect(first).toEqual({ createdAt: 2_000_000_001, millisecond: 999 })
    expect(second).toEqual({ createdAt: 2_000_000_002, millisecond: 0 })
  })

  it('replaces stale ms tags and derives the local ordering timestamp', () => {
    const tags = withDmMessageOrderTag(
      [
        ['p', 'recipient'],
        ['ms', '12']
      ],
      345
    )

    expect(tags).toEqual([
      ['p', 'recipient'],
      ['ms', '345']
    ])
    expect(getDmMessageCreatedAt({ created_at: 123, tags })).toBe(123.345)
  })

  it.each([undefined, '', '-1', '1.5', '1000', 'not-a-number'])(
    'falls back to seconds for an invalid ms value: %s',
    (value) => {
      const tags = value === undefined ? [] : [['ms', value]]
      expect(getDmMessageCreatedAt({ created_at: 123, tags })).toBe(123)
    }
  )
})
