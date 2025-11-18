import { getEventKey } from '@/lib/event'
import { Event } from 'nostr-tools'
import { useMemo } from 'react'

export function useStuff(stuff: Event | string) {
  const resolvedStuff = useMemo(
    () =>
      typeof stuff === 'string'
        ? { event: undefined, externalContent: stuff, stuffKey: stuff }
        : { event: stuff, externalContent: undefined, stuffKey: getEventKey(stuff) },
    [stuff]
  )

  return resolvedStuff
}
