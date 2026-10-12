import type { TEmbeddedNode } from '@/lib/content-parser'
import { describe, expect, it } from 'vitest'
import { groupContentNodes, isBlockContentNode, isMediaContentNode } from './node-layout'

describe('content node layout', () => {
  it('keeps links, mentions, hashtags and emojis in the same text flow', () => {
    const nodes: TEmbeddedNode[] = [
      { type: 'text', data: 'hello ' },
      { type: 'mention', data: 'nostr:npub1test' },
      { type: 'url', data: 'https://example.com' },
      { type: 'hashtag', data: '#hello' },
      { type: 'emoji', data: ':hello:' }
    ]
    expect(groupContentNodes(nodes)).toEqual([{ type: 'inline', nodes }])
  })

  it('separates consecutive blocks without empty text groups or edge spacers', () => {
    const preview: TEmbeddedNode = { type: 'web-preview', data: 'https://example.com' }
    const images: TEmbeddedNode = { type: 'images', data: ['https://example.com/image.png'] }
    expect(groupContentNodes([preview, { type: 'text', data: '\n' }, images])).toEqual([
      { type: 'block', node: preview },
      { type: 'block', node: images }
    ])
  })

  it('replaces the line breaks adjoining blocks while preserving internal line breaks', () => {
    const media: TEmbeddedNode = { type: 'media', data: 'https://example.com/video.mp4' }
    expect(
      groupContentNodes([
        { type: 'text', data: 'first\nsecond\r\n' },
        media,
        { type: 'text', data: '\r\nthird\nfourth' }
      ])
    ).toEqual([
      { type: 'inline', nodes: [{ type: 'text', data: 'first\nsecond' }] },
      { type: 'block', node: media },
      { type: 'inline', nodes: [{ type: 'text', data: 'third\nfourth' }] }
    ])
  })

  it('preserves additional blank lines and does not mutate the parsed nodes', () => {
    const nodes: TEmbeddedNode[] = [
      { type: 'text', data: 'before\n\n' },
      { type: 'invoice', data: 'lnbc1test' },
      { type: 'text', data: '\n\nafter' }
    ]
    const original = structuredClone(nodes)
    const groups = groupContentNodes(nodes)
    expect(groups[0]).toEqual({ type: 'inline', nodes: [{ type: 'text', data: 'before\n' }] })
    expect(groups[2]).toEqual({ type: 'inline', nodes: [{ type: 'text', data: '\nafter' }] })
    expect(nodes).toEqual(original)
  })

  it('retains the original inline text flow after previews and media are filtered out', () => {
    const nodes: TEmbeddedNode[] = [
      { type: 'url', data: 'https://example.com' },
      { type: 'web-preview', data: 'https://example.com' },
      { type: 'text', data: '\nnext paragraph\n' },
      { type: 'media', data: 'https://example.com/video.mp4' },
      { type: 'text', data: 'after' }
    ]
    const visible = nodes.filter((node) => node.type !== 'web-preview' && !isMediaContentNode(node))
    expect(groupContentNodes(visible)).toEqual([{ type: 'inline', nodes: visible }])
  })

  it('classifies previews and embedded notes as blocks without treating them as hidden media', () => {
    for (const type of ['web-preview', 'event', 'invoice'] as const) {
      const node: TEmbeddedNode = { type, data: 'test' }
      expect(isBlockContentNode(node)).toBe(true)
      expect(isMediaContentNode(node)).toBe(false)
    }
  })
})
