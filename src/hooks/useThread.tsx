import threadService from '@/services/thread.service'
import { useSyncExternalStore } from 'react'

const NOOP = () => {}

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

export function useAncestorChain(currentKey: string, rootKey: string) {
  return useSyncExternalStore(
    (cb) => (rootKey ? threadService.listenAllDescendantThreads(rootKey, cb) : NOOP),
    () => threadService.getAncestorChain(currentKey, rootKey)
  )
}
