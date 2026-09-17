import { afterEach, describe, expect, it, vi } from 'vitest'
import { autoResizeTextarea, getCaretScrollDelta } from './textarea'

afterEach(() => vi.unstubAllGlobals())

describe('caret visibility scrolling', () => {
  it('keeps visible text stationary, including the last visible line', () => {
    expect(getCaretScrollDelta(240, 260, 160, 760)).toBe(0)
    expect(getCaretScrollDelta(730, 750, 160, 760)).toBe(0)
    expect(getCaretScrollDelta(740, 760, 160, 760)).toBe(0)
  })

  it('scrolls only the overflow on Enter and then settles without reversing', () => {
    expect(getCaretScrollDelta(768, 788, 160, 760)).toBe(28)
    expect(getCaretScrollDelta(740, 760, 160, 760)).toBe(0)
    expect(getCaretScrollDelta(130, 150, 160, 760)).toBe(-30)
  })

  it('reveals the caret above a mobile keyboard without centering it', () => {
    expect(getCaretScrollDelta(350, 370, 160, 400)).toBe(0)
    expect(getCaretScrollDelta(390, 410, 160, 400)).toBe(10)
    expect(getCaretScrollDelta(100, 120, 160, 100)).toBe(0)
  })
})

describe('textarea sizing without collapsing the editor', () => {
  it.each(['border-box', 'content-box'])(
    'measures the final empty line with %s sizing',
    (boxSizing) => {
      const mirror = { style: {}, textContent: '', scrollHeight: 116, remove: vi.fn() }
      const append = vi.fn()
      vi.stubGlobal('document', { createElement: () => mirror, body: { append } })
      vi.stubGlobal('getComputedStyle', () => ({
        boxSizing,
        paddingTop: '8px',
        paddingBottom: '8px',
        borderTopWidth: '1px',
        borderBottomWidth: '1px'
      }))
      const heights: string[] = []
      const style = {
        get height() {
          return heights.at(-1) ?? '200px'
        },
        set height(value: string) {
          heights.push(value)
        },
        overflowAnchor: ''
      }
      const textarea = {
        style,
        value: 'last line\n',
        dir: 'auto',
        scrollTop: 28
      } as HTMLTextAreaElement
      autoResizeTextarea(textarea)
      expect(mirror.textContent).toBe('last line\n\u200b')
      expect(heights).toEqual([boxSizing === 'border-box' ? '118px' : '100px'])
      expect(textarea.scrollTop).toBe(0)
      expect(mirror.remove).toHaveBeenCalledOnce()
      // The layout effect after the input handler should not resize a second time.
      autoResizeTextarea(textarea)
      expect(heights).toHaveLength(1)
    }
  )
})
