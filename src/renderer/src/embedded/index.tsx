import reactStringReplace from 'react-string-replace'
import { TEmbeddedRenderer } from './types'

export * from './EmbeddedHashtag'
export * from './EmbeddedNormalUrl'
export * from './EmbeddedNostrNpub'
export * from './EmbeddedNostrProfile'

export function embedded(content: string, renderers: TEmbeddedRenderer[]) {
  let nodes: React.ReactNode[] = [content]

  renderers.forEach((renderer) => {
    nodes = reactStringReplace(nodes, renderer.regex, renderer.render)
  })

  return nodes
}
