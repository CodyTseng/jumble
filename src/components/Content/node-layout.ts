import type { TEmbeddedNode, TEmbeddedNodeType } from '@/lib/content-parser'

export const CONTENT_LAYOUT_CLASS_NAME = 'flex flex-col gap-2'

const NODE_LAYOUTS = {
  text: 'inline',
  url: 'inline',
  'bare-url': 'inline',
  mention: 'inline',
  hashtag: 'inline',
  emoji: 'inline',
  'websocket-url': 'inline',
  image: 'block',
  images: 'block',
  media: 'block',
  event: 'block',
  invoice: 'block',
  youtube: 'block',
  'x-post': 'block',
  'web-preview': 'block'
} satisfies Record<TEmbeddedNodeType, 'inline' | 'block'>

export function isBlockContentNode(node: TEmbeddedNode) {
  return NODE_LAYOUTS[node.type] === 'block'
}

export function isMediaContentNode(node: TEmbeddedNode) {
  return ['image', 'images', 'media', 'youtube', 'x-post'].includes(node.type)
}

type TContentGroup =
  | { type: 'inline'; nodes: TEmbeddedNode[] }
  | { type: 'block'; node: TEmbeddedNode }

// Inline nodes share one text flow. Blocks become separate flex items; the
// parent's gap provides spacing only between visible items, never at the ends.
export function groupContentNodes(nodes: TEmbeddedNode[]): TContentGroup[] {
  const groups: TContentGroup[] = []
  let inlineNodes: TEmbeddedNode[] = []

  const flushInline = (beforeBlock: boolean) => {
    const first = inlineNodes[0]
    const last = inlineNodes.at(-1)
    // A block already supplies a line break. Preserve additional blank lines.
    if (first?.type === 'text' && groups.at(-1)?.type === 'block') {
      inlineNodes[0] = { ...first, data: first.data.replace(/^[ \t]*\r?\n/, '') }
    }
    if (last?.type === 'text' && beforeBlock) {
      const index = inlineNodes.length - 1
      const current = inlineNodes[index]
      if (current.type === 'text') {
        inlineNodes[index] = { ...current, data: current.data.replace(/\r?\n[ \t]*$/, '') }
      }
    }
    const visibleNodes = inlineNodes.filter((node) => node.type !== 'text' || node.data !== '')
    if (
      visibleNodes.some(
        (node) => node.type !== 'text' || node.data.trim() || node.data.includes('\n')
      )
    ) {
      groups.push({ type: 'inline', nodes: visibleNodes })
    }
    inlineNodes = []
  }

  for (const node of nodes) {
    if (isBlockContentNode(node)) {
      flushInline(true)
      groups.push({ type: 'block', node })
    } else {
      inlineNodes.push(node)
    }
  }
  flushInline(false)
  return groups
}
