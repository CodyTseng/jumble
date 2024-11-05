export function formatCount(count?: number) {
  if (count === undefined || count <= 0) return ''
  return count >= 100 ? '99+' : count
}
