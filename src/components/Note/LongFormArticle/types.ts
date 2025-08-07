import { ComponentProps } from 'react'
import type { Components as RmComponents } from 'react-markdown'
import type { Data, Node } from 'unist'

// Extend the Components interface to include your custom component
export interface Components extends RmComponents {
  nostr: React.ComponentType<{
    rawText: string
    bech32Id?: string
  }>
}

export interface NostrNode extends Node {
  type: 'nostr'
  data: Data & {
    hName: string
    hProperties: ComponentProps<Components['nostr']>
  }
}
