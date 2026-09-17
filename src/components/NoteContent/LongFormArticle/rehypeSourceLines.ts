import { Root } from 'hast'

/** Mark top-level Markdown blocks for the editor's scroll mapping. */
export function rehypeSourceLines() {
  return (tree: Root) => {
    for (const node of tree.children) {
      if (node.type === 'element' && node.position) {
        node.properties['data-source-line'] = node.position.start.line
        node.properties['data-source-end-line'] = node.position.end.line
      }
    }
  }
}
