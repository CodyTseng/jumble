import threadService from '@/services/thread.service'
import { useSyncExternalStore } from 'react'

export function useThread(stuffKey: string) {
  return useSyncExternalStore(
    (cb) => threadService.listenThread(stuffKey, cb),
    () => threadService.getThread(stuffKey)
  )
}

export function useAllDescendantThreads(stuffKey: string) {
  return useSyncExternalStore(
    (cb) => threadService.listenAllDescendantThreads(stuffKey, cb),
    () => threadService.getAllDescendantThreads(stuffKey)
  )
}
