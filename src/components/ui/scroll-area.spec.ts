import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ScrollArea } from './scroll-area'

describe('window-scroll page container', () => {
  it('overrides both Radix overflow axes so the viewport cannot trap mobile scrolling', () => {
    const html = renderToStaticMarkup(
      createElement(ScrollArea, { windowScroll: true }, createElement('p', null, 'Page content'))
    )
    expect(html).toContain('overflow:visible')
    expect(html).toContain('overflow-x:visible;overflow-y:visible')
    expect(html).toContain('Page content')
  })

  it('keeps the Radix viewport and content wrapper in both scrolling modes', () => {
    for (const windowScroll of [false, true]) {
      const html = renderToStaticMarkup(
        createElement(
          ScrollArea,
          { windowScroll },
          createElement('textarea', { defaultValue: 'Draft' })
        )
      )
      expect(html).toMatch(
        /data-radix-scroll-area-viewport[^>]*><div[^>]*><textarea>Draft<\/textarea><\/div>/
      )
    }
  })
})
