import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Markdown from 'react-markdown'
import { describe, expect, it } from 'vitest'
import { rehypeSourceLines } from '@/components/NoteContent/LongFormArticle/rehypeSourceLines'
import { interpolateScroll } from './usePreviewScrollSync'

describe('article preview scroll mapping', () => {
  const points = [
    { source: 0, target: 0 },
    { source: 200, target: 100 },
    { source: 400, target: 900 },
    { source: 1000, target: 1200 }
  ]

  it('interpolates between content blocks with different rendered heights', () => {
    expect(interpolateScroll(100, points)).toBe(50)
    expect(interpolateScroll(300, points)).toBe(500)
    expect(interpolateScroll(700, points)).toBe(1050)
  })

  it('keeps the top and bottom aligned and clamps overscroll', () => {
    expect(interpolateScroll(-10, points)).toBe(0)
    expect(interpolateScroll(1000, points)).toBe(1200)
    expect(interpolateScroll(1100, points)).toBe(1200)
    expect(interpolateScroll(100, [{ source: 0, target: 0 }])).toBe(0)
  })

  it('marks source positions on headings, paragraphs and lists without marking inline text', () => {
    const html = renderToStaticMarkup(
      createElement(Markdown, {
        rehypePlugins: [rehypeSourceLines],
        children: '# Heading\n\nA **bold** paragraph\n\n- One\n- Two'
      })
    )
    expect(html).toContain('<h1 data-source-line="1" data-source-end-line="1">')
    expect(html).toContain('<p data-source-line="3" data-source-end-line="3">')
    expect(html).toContain('<ul data-source-line="5" data-source-end-line="6">')
    expect(html).toContain('<strong>bold</strong>')
  })
})
