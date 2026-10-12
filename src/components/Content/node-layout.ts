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

  const flushInline = (nextBlock?: TEmbeddedNode) => {
    // Block spacing comes from gap, so whitespace at either edge must not
    // introduce additional line boxes. Internal line breaks stay untouched.
    const previousGroup = groups.at(-1)
    const afterPreview =
      previousGroup?.type === 'block' && previousGroup.node.type === 'web-preview'
    if (afterPreview && inlineNodes[0]?.type === 'text') {
      // A generated preview replaces the paragraph's line break, but must
      // preserve any extra blank lines the author put before the next paragraph.
      const first = inlineNodes[0]
      inlineNodes[0] = { ...first, data: first.data.replace(/^[ \t]*\r?\n/, '') }
    }
    while (!afterPreview && previousGroup?.type === 'block' && inlineNodes[0]?.type === 'text') {
      const first = inlineNodes[0]
      const data = first.data.trimStart()
      if (data) {
        inlineNodes[0] = { ...first, data }
        break
      }
      inlineNodes.shift()
    }
    while (nextBlock && nextBlock.type !== 'web-preview' && inlineNodes.length) {
      const last = inlineNodes.at(-1)
      if (last?.type !== 'text') break
      const data = last.data.trimEnd()
      if (data) {
        inlineNodes[inlineNodes.length - 1] = { ...last, data }
        break
      }
      inlineNodes.pop()
    }
    const visibleNodes = inlineNodes.filter((node) => node.type !== 'text' || node.data !== '')
    if (visibleNodes.length) {
      groups.push({ type: 'inline', nodes: visibleNodes })
    }
    inlineNodes = []
  }

  for (const node of nodes) {
    if (isBlockContentNode(node)) {
      flushInline(node)
      groups.push({ type: 'block', node })
    } else {
      inlineNodes.push(node)
    }
  }
  flushInline()
  return groups
}
