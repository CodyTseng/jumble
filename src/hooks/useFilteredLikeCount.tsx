import { useFilteredLikes } from './useFilteredLikes'

export function useFilteredLikeCount(stuffKey: string) {
  return useFilteredLikes(stuffKey).length
}
