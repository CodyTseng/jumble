import {
  EmbeddedBareDomainParser,
  EmbeddedHashtagParser,
  EmbeddedUrlParser,
  parseContent
} from '@/lib/content-parser'
import { describe, expect, it } from 'vitest'
import { insertParagraphLinkPreviews } from './link-previews'

const firstUrl = 'https://example.com/first'
const secondUrl = 'https://example.com/second'
const parse = (content: string) =>
  insertParagraphLinkPreviews(
    parseContent(content, [EmbeddedUrlParser, EmbeddedHashtagParser, EmbeddedBareDomainParser])
  )

describe('paragraph link previews', () => {
  it('places each standalone URL preview before the next paragraph', () => {
    expect(parse(`${firstUrl}\n${secondUrl}\n后面的文字`)).toEqual([
      { type: 'url', data: firstUrl },
      { type: 'web-preview', data: firstUrl },
      { type: 'text', data: '\n' },
      { type: 'url', data: secondUrl },
      { type: 'web-preview', data: secondUrl },
      { type: 'text', data: '\n' },
      { type: 'text', data: '后面的文字' }
    ])
  })

  it('waits for the end of inline text, including parsed inline nodes', () => {
    expect(parse(`看看 ${firstUrl} #hello 还有说明\n下一段`)).toEqual([
      { type: 'text', data: '看看 ' },
      { type: 'url', data: firstUrl },
      { type: 'text', data: ' ' },
      { type: 'hashtag', data: '#hello' },
      { type: 'text', data: ' 还有说明' },
      { type: 'web-preview', data: firstUrl },
      { type: 'text', data: '\n' },
      { type: 'text', data: '下一段' }
    ])
  })

  it('shows only the last URL preview in a paragraph', () => {
    const nodes = parse(`对比 ${firstUrl} 和 ${secondUrl}，然后继续阅读`)
    expect(nodes.filter((node) => node.type === 'web-preview')).toEqual([
      { type: 'web-preview', data: secondUrl }
    ])
    expect(nodes.at(-2)).toEqual({ type: 'text', data: '，然后继续阅读' })
  })

  it('preserves line endings and blank lines when previews are hidden', () => {
    const content = `قبل ${firstUrl} بعد\r\n\r\nNext paragraph\n\n${secondUrl}`
    const restored = parse(content)
      .filter((node) => node.type !== 'web-preview')
      .map((node) => node.data)
      .join('')
    expect(restored).toBe(content)
  })

  it('places a pending preview before embedded media without previewing media URLs', () => {
    expect(parse(`${firstUrl} https://example.com/image.png`)).toEqual([
      { type: 'url', data: firstUrl },
      { type: 'text', data: ' ' },
      { type: 'web-preview', data: firstUrl },
      { type: 'images', data: ['https://example.com/image.png'] }
    ])
  })

  it('keeps bare domains as links without previews', () => {
    expect(parse('看看 example.com\n没有链接的文字').some((n) => n.type === 'web-preview')).toBe(
      false
    )
  })
})
