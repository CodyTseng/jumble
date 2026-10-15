import type { Event } from 'nostr-tools'
import { ExtendedKind } from '@/constants'

export const NAPPLET_KINDS = [
  ExtendedKind.NAPPLET_SNAPSHOT,
  ExtendedKind.ROOT_NAPPLET,
  ExtendedKind.NAPPLET
]
export const isNapplet = (event: Pick<Event, 'kind'>) => NAPPLET_KINDS.includes(event.kind)
export const nappletTitle = (event: Event) =>
  event.tags.find((tag) => tag[0] === 'title')?.[1] ||
  event.tags.find((tag) => tag[0] === 'd')?.[1] ||
  'Napplet'
export const nappletDescription = (event: Event) =>
  event.tags.some((tag) => tag[0] === 'path')
    ? (event.tags.find((tag) => tag[0] === 'description')?.[1] ?? event.content)
    : event.content
