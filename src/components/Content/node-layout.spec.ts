import type { TEmbeddedNode } from '@/lib/content-parser'
import { EmbeddedUrlParser, parseContent } from '@/lib/content-parser'
import { describe, expect, it } from 'vitest'
import { insertParagraphLinkPreviews } from './link-previews'
import { groupContentNodes, isBlockContentNode, isMediaContentNode } from './node-layout'

describe('content node layout', () => {
  it.each(['\n', '\r\n'])(
    'preserves authored blank lines after an inserted preview (%j)',
    (newline) => {
      const content = `See https://example.com for details.${newline}${newline}${newline}Next paragraph`
      const nodes = insertParagraphLinkPreviews(parseContent(content, [EmbeddedUrlParser]))
      const original = structuredClone(nodes)
      const groups = groupContentNodes(nodes)
      const nextParagraph = groups.at(-1)
      expect(nextParagraph?.type).toBe('inline')
      if (nextParagraph?.type !== 'inline') throw new Error('Expected the next paragraph')
      expect(nextParagraph.nodes.map((node) => node.data).join('')).toBe(
        `${newline}${newline}Next paragraph`
      )
      expect(nodes).toEqual(original)
    }
  )

  it('does not introduce an empty text group after a preview with a single line break', () => {
    const nodes = insertParagraphLinkPreviews(
      parseContent('See https://example.com\nNext paragraph', [EmbeddedUrlParser])
    )
    expect(groupContentNodes(nodes).at(-1)).toEqual({
      type: 'inline',
      nodes: [{ type: 'text', data: 'Next paragraph' }]
    })
  })

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

  it('removes blank lines at block boundaries without mutating the parsed nodes', () => {
    const nodes: TEmbeddedNode[] = [
      { type: 'text', data: 'before\n\n' },
      { type: 'invoice', data: 'lnbc1test' },
      { type: 'text', data: '\n\nafter' }
    ]
    const original = structuredClone(nodes)
    const groups = groupContentNodes(nodes)
    expect(groups[0]).toEqual({ type: 'inline', nodes: [{ type: 'text', data: 'before' }] })
    expect(groups[2]).toEqual({ type: 'inline', nodes: [{ type: 'text', data: 'after' }] })
    expect(nodes).toEqual(original)
  })

  it('preserves intentional blank lines within pure text', () => {
    const nodes: TEmbeddedNode[] = [
      { type: 'text', data: '\n\nfirst\n\n\n\nsecond\r\n\r\nthird\n\n' }
    ]
    expect(groupContentNodes(nodes)).toEqual([{ type: 'inline', nodes }])
  })

  it('removes whitespace split across multiple nodes between a preview and media', () => {
    const preview: TEmbeddedNode = { type: 'web-preview', data: 'https://example.com' }
    const media: TEmbeddedNode = { type: 'media', data: 'https://example.com/video.mp4' }
    expect(
      groupContentNodes([
        preview,
        { type: 'text', data: '\n' },
        { type: 'text', data: ' \r\n' },
        { type: 'text', data: '\n' },
        media
      ])
    ).toEqual([
      { type: 'block', node: preview },
      { type: 'block', node: media }
    ])
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
