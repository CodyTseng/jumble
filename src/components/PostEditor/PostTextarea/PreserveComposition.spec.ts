// @vitest-environment jsdom

import type { Editor as TEditor } from '@tiptap/core'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

let Editor: typeof import('@tiptap/core').Editor
let Document: typeof import('@tiptap/extension-document').default
let Paragraph: typeof import('@tiptap/extension-paragraph').default
let Text: typeof import('@tiptap/extension-text').default
let Mention: typeof import('@tiptap/extension-mention').default
let preserve: typeof import('./PreserveComposition').PreserveComposition
let editor: TEditor
let container: HTMLDivElement

beforeAll(async () => {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/154.0.0.0 Safari/537.36'
  )
  ;({ Editor } = await import('@tiptap/core'))
  ;({ default: Document } = await import('@tiptap/extension-document'))
  ;({ default: Paragraph } = await import('@tiptap/extension-paragraph'))
  ;({ default: Text } = await import('@tiptap/extension-text'))
  ;({ default: Mention } = await import('@tiptap/extension-mention'))
  ;({ PreserveComposition: preserve } = await import('./PreserveComposition'))
})

beforeEach(() => {
  vi.useFakeTimers()
  container = document.createElement('div')
  document.body.appendChild(container)
})
afterEach(() => {
  editor?.destroy()
  container.remove()
  vi.clearAllTimers()
  vi.useRealTimers()
})
afterAll(() => vi.restoreAllMocks())

function createEditor(protectedComposition = true) {
  editor = new Editor({
    element: container,
    extensions: [Document, Paragraph, Text, Mention, ...(protectedComposition ? [preserve] : [])],
    content: '<p>nihaoma</p>',
    editorProps: { handleScrollToSelection: () => true }
  })
  editor.commands.setTextSelection(8)
  editor.view.focus()
  return editor.view
}

describe('preserving native composition edits', () => {
  it.each([false, true])(
    'does not restore deleted pinyin during Backspace command probes (protected: %s)',
    async (protectedComposition) => {
      const view = createEditor(protectedComposition)
      view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      const text = view.dom.querySelector('p')!.firstChild!
      const writes = vi.spyOn(text, 'nodeValue', 'set')
      // Chrome updates the composition DOM before ProseMirror parses it. Its
      // deletion detector then runs the actual mention and default keymaps.
      text.nodeValue = 'nihaom'
      document.getSelection()!.collapse(text, 6)
      view.dom.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertCompositionText',
          isComposing: true,
          data: 'nihaom'
        })
      )
      await vi.advanceTimersByTimeAsync(30)
      expect(editor.getText()).toBe('nihaom')
      expect(view.composing).toBe(true)
      if (protectedComposition) {
        expect(writes.mock.calls.map(([value]) => value)).toEqual(['nihaom'])
        // Continue composing in the same native text node after correction.
        expect(view.dom.querySelector('p')!.firstChild).toBe(text)
        text.nodeValue = 'nihaomen'
        document.getSelection()!.collapse(text, 8)
        await vi.advanceTimersByTimeAsync(30)
        expect(editor.getText()).toBe('nihaomen')
        expect(view.composing).toBe(true)
        text.nodeValue = '你们好'
        document.getSelection()!.collapse(text, 3)
        view.dom.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
        await vi.advanceTimersByTimeAsync(30)
        expect(editor.getText()).toBe('你们好')
        expect(view.composing).toBe(false)
      } else {
        expect(writes.mock.calls.map(([value]) => value)).toContain('nihaoma')
      }
    }
  )

  it('allows document edits, selection changes and plugin metadata during composition', () => {
    const view = createEditor()
    view.dom.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    const transaction = vi.fn()
    editor.on('transaction', transaction)
    view.dispatch(editor.state.tr)
    expect(transaction).not.toHaveBeenCalled()
    view.dispatch(editor.state.tr.insertText('n'))
    view.dispatch(editor.state.tr.setSelection(editor.state.selection))
    view.dispatch(editor.state.tr.setStoredMarks([]))
    view.dispatch(editor.state.tr.setMeta('plugin-update', true))
    view.dispatch(editor.state.tr.scrollIntoView())
    expect(transaction).toHaveBeenCalledTimes(5)
  })

  it('allows ordinary transactions outside composition', () => {
    const view = createEditor()
    const transaction = vi.fn()
    editor.on('transaction', transaction)
    view.dispatch(editor.state.tr)
    expect(transaction).toHaveBeenCalledOnce()
  })
})
