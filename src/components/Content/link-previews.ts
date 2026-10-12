import type { TEmbeddedNode } from '@/lib/content-parser'
import { isBlockContentNode } from './node-layout'

// A newline or an embedded block ends a paragraph. Keep its last ordinary URL
// pending so a preview never interrupts the paragraph's inline text.
export function insertParagraphLinkPreviews(nodes: TEmbeddedNode[]): TEmbeddedNode[] {
  const result: TEmbeddedNode[] = []
  let pendingUrl: string | undefined

  const flushPreview = () => {
    if (!pendingUrl) return
    result.push({ type: 'web-preview', data: pendingUrl })
    pendingUrl = undefined
  }

  for (const node of nodes) {
    if (node.type === 'text') {
      for (const part of node.data.split(/(\r?\n)/)) {
        if (!part) continue
        if (part === '\n' || part === '\r\n') flushPreview()
        result.push({ type: 'text', data: part })
      }
    } else {
      if (isBlockContentNode(node)) {
        flushPreview()
      }
      result.push(node)
      if (node.type === 'url') pendingUrl = node.data
    }
  }

  flushPreview()
  return result
}
