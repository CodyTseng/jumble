// @vitest-environment jsdom

import { Provider } from 'jotai'
import { act, createElement } from 'react'
import { createRoot, Root } from 'react-dom/client'
import type { Editor } from '@tiptap/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NewPost from '@/components/NewPost'
import SidebarPostButton from '@/components/Sidebar/PostButton'
import BottomPostButton from '@/components/BottomNavigationBar/PostButton'
import PostEditor from './index'

const harness = vi.hoisted(() => ({
  small: false,
  editor: null as Editor | null,
  mounts: 0,
  unmounts: 0
}))

vi.mock('@/PageManager', () => ({ useSecondaryPage: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/link', () => ({ toNewArticle: vi.fn(), toNote: vi.fn() }))
vi.mock('@/providers/ScreenSizeProvider', () => ({
  useScreenSize: () => ({ isSmallScreen: harness.small })
}))
vi.mock('@/providers/NostrProvider', () => ({
  useNostr: () => ({ pubkey: 'self', checkLogin: (callback: () => void) => callback() })
}))
vi.mock('@/providers/DraftBoxProvider', () => ({
  useDraftBox: () => ({ openDraftBox: vi.fn(), startEditingDraft: vi.fn() })
}))
vi.mock('@/services/post-draft.service', () => ({
  default: { findDraftForParent: vi.fn() }
}))
vi.mock('@/services/post-editor.service', () => ({ default: { isSuggestionPopupOpen: false } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('./DraftsButton', () => ({ default: () => null }))
// Keep the real modal, portal, scroll area and TipTap instance. Isolate network,
// account and publishing concerns with a small stateful editor body.
vi.mock('./PostContent', async () => {
  const { createElement, forwardRef, useEffect, useImperativeHandle, useState } = await import(
    'react'
  )
  const { EditorContent, useEditor } = await import('@tiptap/react')
  const { default: Document } = await import('@tiptap/extension-document')
  const { default: Paragraph } = await import('@tiptap/extension-paragraph')
  const { default: Text } = await import('@tiptap/extension-text')
  const { UndoRedo } = await import('@tiptap/extensions')
  return {
    default: forwardRef(function EditorBody(_, ref) {
      const editor = useEditor({ extensions: [Document, Paragraph, Text, UndoRedo] })
      const [options, setOptions] = useState(false)
      harness.editor = editor
      useImperativeHandle(ref, () => ({
        isDirty: () => !!editor?.getText(),
        hasPersistedDraft: () => false,
        saveDraft: async () => undefined
      }))
      useEffect(() => {
        harness.mounts++
        return () => {
          harness.unmounts++
        }
      }, [])
      return createElement(
        'section',
        null,
        createElement(EditorContent, { editor }),
        createElement('input', { 'aria-label': 'Poll option', defaultValue: '' }),
        createElement(
          'button',
          { onClick: () => setOptions(!options) },
          options ? 'Options open' : 'Options closed'
        )
      )
    })
  }
})

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  harness.small = false
  harness.editor = null
  harness.mounts = 0
  harness.unmounts = 0
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function writeDraft() {
  const editor = harness.editor!
  await act(async () => {
    editor.commands.insertContent('Keep this draft')
    editor.commands.setTextSelection({ from: 2, to: 6 })
    const button = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent === 'Options closed'
    )!
    button.click()
  })
  const poll = document.querySelector<HTMLInputElement>('[aria-label="Poll option"]')!
  poll.value = 'Keep this option'
  return { editor, poll, editorElement: document.querySelector('.tiptap') }
}

function expectDraftPreserved(draft: Awaited<ReturnType<typeof writeDraft>>) {
  expect(harness.editor).toBe(draft.editor)
  expect(document.querySelector('.tiptap')).toBe(draft.editorElement)
  expect(draft.editor.getText()).toBe('Keep this draft')
  expect(draft.editor.state.selection.from).toBe(2)
  expect(draft.editor.state.selection.to).toBe(6)
  expect(document.querySelector('[aria-label="Poll option"]')).toBe(draft.poll)
  expect(draft.poll.value).toBe('Keep this option')
  expect(document.body.textContent).toContain('Options open')
  expect(harness.mounts).toBe(1)
  expect(harness.unmounts).toBe(0)
}

describe('post editor across responsive layout changes', () => {
  it.each([false, true])(
    'preserves the open editor, selection and undo history (initial mobile: %s)',
    async (small) => {
      harness.small = small
      const render = async () => {
        await act(async () =>
          root.render(createElement(PostEditor, { open: true, setOpen: vi.fn() }))
        )
      }
      await render()
      const draft = await writeDraft()
      for (const next of [!small, small, !small]) {
        harness.small = next
        await render()
        expectDraftPreserved(draft)
      }
      await act(async () => {
        draft.editor.commands.undo()
      })
      expect(draft.editor.getText()).toBe('')
    }
  )

  it.each([false, true])(
    'keeps the shared composer when navigation buttons unmount (initial mobile: %s)',
    async (small) => {
      harness.small = small
      const render = async () => {
        await act(async () =>
          root.render(
            createElement(
              Provider,
              null,
              createElement(
                'nav',
                null,
                harness.small
                  ? createElement(BottomPostButton)
                  : createElement(SidebarPostButton, { collapse: false })
              ),
              createElement(NewPost)
            )
          )
        )
      }
      await render()
      await act(async () => {
        container.querySelector<HTMLButtonElement>('nav button')!.click()
      })
      const draft = await writeDraft()
      for (const next of [!small, small]) {
        harness.small = next
        await render()
        expectDraftPreserved(draft)
      }
    }
  )
})
