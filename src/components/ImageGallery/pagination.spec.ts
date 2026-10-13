import { describe, expect, it } from 'vitest'
import { getVisibleImageIndexes } from './pagination'

describe('image pagination', () => {
  it('shows one dot per image when there are at most nine', () => {
    expect(getVisibleImageIndexes(0, 0)).toEqual([])
    expect(getVisibleImageIndexes(3, 1)).toEqual([0, 1, 2])
    expect(getVisibleImageIndexes(9, 8)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('keeps the current image inside a moving window of nine dots', () => {
    expect(getVisibleImageIndexes(20, 0)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
    expect(getVisibleImageIndexes(20, 10)).toEqual([6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(getVisibleImageIndexes(20, 19)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19])
    for (let current = 0; current < 20; current++) {
      const indexes = getVisibleImageIndexes(20, current)
      expect(indexes).toHaveLength(9)
      expect(indexes).toContain(current)
    }
  })
})
