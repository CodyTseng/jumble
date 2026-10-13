const MAX_VISIBLE_DOTS = 9

export function getVisibleImageIndexes(count: number, current: number): number[] {
  const visibleCount = Math.min(count, MAX_VISIBLE_DOTS)
  const start = Math.max(0, Math.min(current - Math.floor(visibleCount / 2), count - visibleCount))
  return Array.from({ length: visibleCount }, (_, index) => start + index)
}
