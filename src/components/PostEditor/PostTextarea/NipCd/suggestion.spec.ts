// @vitest-environment jsdom

import { formatNipCdInvocation, TNipCdCommand } from '@/lib/nip-cd'
import { parseEditorJsonToText } from '@/lib/tiptap'
import { Editor, type JSONContent } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Mention from '@tiptap/extension-mention'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NipCdInvocationDecoration } from './invocation-decoration'
import { NipCdInvocation } from './invocation-node'
import { closeNipCdSuggestion, NipCdSuggestion, TNipCdEditorContext } from './suggestion'

const mocks = vi.hoisted(() => ({
  getCachedCommands: vi.fn(),
  reloadCachedCatalogs: vi.fn(),
  getCachedExecutorProfiles: vi.fn(),
  refresh: vi.fn(),
  onSuggestions: vi.fn(),
  onMenu: vi.fn(),
  onPopupVisible: vi.fn()
}))
vi.mock('@/services/nip-cd.service', () => ({
  default: {
    getCachedCommands: mocks.getCachedCommands,
    reloadCachedCatalogs: mocks.reloadCachedCatalogs,
    getCachedExecutorProfiles: mocks.getCachedExecutorProfiles,
    refresh: mocks.refresh
  }
}))
vi.mock('@/services/custom-emoji.service', () => ({ default: {} }))
vi.mock('@/lib/utils', () => ({ cn: (...classes: string[]) => classes.join(' ') }))
vi.mock('@/providers/ContentPolicyProvider', () => ({
  useContentPolicy: () => ({ autoLoadProfilePicture: true })
}))
vi.mock('@tiptap/react', () => ({
  ReactRenderer: class {
    element = document.createElement('div')
    props
    ref = {
      onKeyDown: (event: KeyboardEvent) => {
        if (event.key !== 'Enter' || event.ctrlKey || !this.props.items.length) return false
        this.props.command(this.props.items[0])
        return true
      }
    }
    constructor(
      _component: unknown,
      {
        props
      }: {
        props: {
          items: TNipCdCommand[]
          command: (item: TNipCdCommand) => void
          loading: boolean
        }
      }
    ) {
      this.props = props
      mocks.onSuggestions(props.items)
      mocks.onMenu(props.loading, props.items)
    }
    updateProps(props: typeof this.props) {
      this.props = props
      mocks.onSuggestions(props.items)
      mocks.onMenu(props.loading, props.items)
    }
    destroy() {}
  }
}))
vi.mock('tippy.js', () => ({
  default: (_anchor: Element, { onShow, onHide }: { onShow: () => void; onHide: () => void }) => {
    const state = { isVisible: true }
    onShow()
    mocks.onPopupVisible(true)
    return {
      state,
      show() {
        state.isVisible = true
        onShow()
        mocks.onPopupVisible(true)
      },
      hide() {
        state.isVisible = false
        onHide()
        mocks.onPopupVisible(false)
      },
      destroy() {
        state.isVisible = false
        mocks.onPopupVisible(false)
      },
      setProps() {}
    }
  }
}))

const executor = getPublicKey(generateSecretKey())
const otherExecutor = getPublicKey(generateSecretKey())
const npub = nip19.npubEncode(executor)
const command = (kind: 1 | 14 | 1111, name: string, target = executor): TNipCdCommand => ({
  id: name,
  executor: target,
  command: name,
  description: 'Synthetic test command',
  title: name,
  scopes: [{ group: 'kind', value: String(kind) }],
  args: []
})
const ping = command(1, 'ping')
const comment = command(1111, 'pingComment')
const dm = command(14, 'private')

let editor: Editor
let container: HTMLDivElement
let context: TNipCdEditorContext | undefined
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.getCachedCommands.mockImplementation(async (target?: string) =>
    [dm, comment, ping].filter((item) => !target || item.executor === target)
  )
  mocks.getCachedExecutorProfiles.mockResolvedValue(new Map())
  mocks.reloadCachedCatalogs.mockResolvedValue(undefined)
  mocks.refresh.mockResolvedValue(false)
  container = document.createElement('div')
  document.body.appendChild(container)
  context = { kind: 1, replyExecutor: executor }
})
afterEach(() => {
  editor?.destroy()
  container.remove()
  vi.clearAllTimers()
  vi.useRealTimers()
})

function createEditor(content?: JSONContent) {
  editor = new Editor({
    element: container,
    content,
    extensions: [
      Document,
      Paragraph,
      Text,
      Mention,
      NipCdInvocation,
      NipCdInvocationDecoration,
      NipCdSuggestion.configure({
        getContext: () => context
      })
    ],
    editorProps: {
      handleScrollToSelection: () => true,
      clipboardTextSerializer(content) {
        return parseEditorJsonToText(content.toJSON(), { trim: false }).replace(/\n$/, '')
      }
    }
  })
  editor.view.focus()
  return editor
}

function key(name: string, options?: KeyboardEventInit) {
  return editor.view.dom.dispatchEvent(
    new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: name,
      ...options
    })
  )
}

function invocation() {
  return editor.view.dom.querySelector('.nip-cd-invocation')?.textContent
}

describe('public slash suggestions', () => {
  it('shows the command and bot name but copies the qualified command', async () => {
    mocks.getCachedExecutorProfiles.mockResolvedValue(new Map([[executor, { name: 'Ping Bot' }]]))
    createEditor()
    const update = vi.fn()
    editor.on('update', update)
    editor.commands.insertContent('/p')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.getCachedCommands).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(mocks.refresh).not.toHaveBeenCalled()
    const named = { ...ping, executorName: 'Ping Bot' }
    expect(mocks.onSuggestions).toHaveBeenLastCalledWith([named])
    expect(mocks.onMenu).toHaveBeenLastCalledWith(false, [named])
    expect(key('Enter', { ctrlKey: true })).toBe(true)
    expect(parseEditorJsonToText(editor.getJSON())).toBe('/p')
    expect(key('Enter')).toBe(false)
    expect(parseEditorJsonToText(editor.getJSON())).toBe(formatNipCdInvocation(ping))
    expect(editor.getJSON().content?.[0].content).toEqual([
      {
        type: 'nipCdInvocation',
        attrs: { invocation: formatNipCdInvocation(ping), executorName: 'Ping Bot' }
      },
      { type: 'text', text: ' ' }
    ])
    expect(invocation()).toBe('/ping\u2009@Ping Bot')
    expect(update).toHaveBeenCalledTimes(2)
    editor.commands.selectAll()
    const copy = editor.view.serializeForClipboard(editor.state.selection.content())
    expect(copy.text).toBe(formatNipCdInvocation(ping) + ' ')
    expect(copy.dom.textContent).toBe(copy.text)
    expect(
      copy.dom
        .querySelector('[data-nip-cd-executor-name]')
        ?.getAttribute('data-nip-cd-executor-name')
    ).toBe('Ping Bot')
  })

  it('looks up an explicit first mention instead of the reply author and preserves draft serialization', async () => {
    context = { kind: 1111, replyExecutor: otherExecutor }
    createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: npub, label: 'Bot' } },
            { type: 'text', text: ' ' }
          ]
        }
      ]
    })
    editor.commands.setTextSelection(3)
    editor.commands.insertContent('/')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.getCachedCommands).toHaveBeenCalledExactlyOnceWith(executor)
    expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith(executor, expect.any(Function))
    expect(mocks.onSuggestions).toHaveBeenLastCalledWith([comment])
    key('Enter')
    expect(invocation()).toBe('/pingComment')
    const serialized = editor.getJSON()
    editor.destroy()
    createEditor(serialized)
    expect(parseEditorJsonToText(editor.getJSON())).toBe(formatNipCdInvocation(comment))
    expect(invocation()).toBe('/pingComment')
  })

  it('suggests a command with tag and relay scopes before those values are known', async () => {
    const relay = 'wss://bot.example/inbox'
    const scoped = {
      ...ping,
      scopes: [...ping.scopes, { group: 'tag:e', value: 'e' }, { group: 'relay', value: relay }]
    }
    const otherAuthor = {
      ...command(1, 'otherAuthor'),
      scopes: [{ group: 'author', value: otherExecutor }]
    }
    context = { kind: 1, author: executor }
    mocks.getCachedCommands.mockResolvedValue([scoped, otherAuthor])
    createEditor()
    editor.commands.insertContent('/')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.onSuggestions).toHaveBeenLastCalledWith([scoped])

    editor.commands.setContent({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: npub, label: 'Bot' } },
            { type: 'text', text: ' ' }
          ]
        }
      ]
    })
    editor.commands.setTextSelection(3)
    editor.commands.insertContent('/')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.onSuggestions).toHaveBeenLastCalledWith([scoped])
    key('Enter')
    expect(invocation()).toBe('/ping')
  })

  it('preserves an existing argument and puts the caret after its separator', async () => {
    createEditor()
    editor.commands.insertContent('/p existing')
    editor.commands.setTextSelection(3)
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.onSuggestions).toHaveBeenLastCalledWith([ping])
    key('Enter')
    const head = formatNipCdInvocation(ping)
    expect(editor.getText()).toBe(head + ' existing')
    expect(invocation()).toBe('/ping')
    expect(editor.state.selection.from).toBe(3)
  })

  it('keeps bare slash local and displays both compatible executors with the same trigger', async () => {
    context = { kind: 1 }
    createEditor()
    editor.commands.insertContent('ordinary /p')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.getCachedCommands).not.toHaveBeenCalled()

    const other = command(1, 'ping', otherExecutor)
    mocks.getCachedCommands.mockResolvedValue([dm, ping, other])
    const avatar = 'https://bot.example/avatar.png'
    mocks.getCachedExecutorProfiles.mockResolvedValue(
      new Map([
        [executor, { name: 'Bot one', avatar }],
        [otherExecutor, { name: 'Bot two' }]
      ])
    )
    editor.commands.setContent('')
    editor.commands.insertContent('/p')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.getCachedCommands).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(mocks.refresh).not.toHaveBeenCalled()
    expect(mocks.onSuggestions).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        { ...ping, executorName: 'Bot one', executorAvatar: avatar },
        { ...other, executorName: 'Bot two' }
      ])
    )
    expect(mocks.onSuggestions.mock.lastCall?.[0]).toHaveLength(2)
  })

  it('reloads the local catalog on reopening but not on each character', async () => {
    createEditor()
    editor.commands.insertContent('/')
    await vi.advanceTimersByTimeAsync(180)
    editor.commands.insertContent('p')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.reloadCachedCatalogs).toHaveBeenCalledOnce()
    key('Escape')
    editor.commands.setContent('')
    editor.commands.insertContent('/')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.reloadCachedCatalogs).toHaveBeenCalledTimes(2)
    expect(mocks.refresh).not.toHaveBeenCalled()
  })

  it('refreshes an explicit bot once, updates an open menu, and does not requery while typing', async () => {
    let finish!: (changed: boolean) => void
    mocks.refresh.mockImplementation((_target, onQuery) => {
      onQuery()
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    mocks.getCachedCommands.mockResolvedValue([ping])
    context = { kind: 1 }
    createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: npub, label: 'Bot' } },
            { type: 'text', text: ' ' }
          ]
        }
      ]
    })
    editor.commands.setTextSelection(3)
    editor.commands.insertContent('/')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.onSuggestions).toHaveBeenLastCalledWith([ping])
    expect(mocks.onMenu).toHaveBeenLastCalledWith(true, [ping])
    editor.commands.insertContent('p')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.refresh).toHaveBeenCalledExactlyOnceWith(executor, expect.any(Function))
    const newer = command(1, 'pong')
    mocks.getCachedCommands.mockResolvedValue([newer])
    finish(true)
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.onSuggestions).toHaveBeenLastCalledWith([newer])
    expect(mocks.onMenu).toHaveBeenLastCalledWith(false, [newer])
  })

  it('dismisses without changing text; an outdated reply/account lookup cannot show a menu', async () => {
    createEditor()
    editor.commands.insertContent('/')
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.onSuggestions).toHaveBeenLastCalledWith([ping])
    expect(key('Escape')).toBe(false)
    expect(editor.getText()).toBe('/')
    expect(editor.view.dom.querySelector('.nip-cd-suggestion')).toBeNull()

    let finish!: (commands: TNipCdCommand[]) => void
    mocks.getCachedCommands.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    editor.commands.setContent('')
    editor.commands.insertContent('/p')
    await vi.advanceTimersByTimeAsync(180)
    mocks.onSuggestions.mockClear()
    context = { kind: 1111, replyExecutor: otherExecutor }
    closeNipCdSuggestion(editor)
    finish([ping])
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.onSuggestions).not.toHaveBeenCalled()
    expect(editor.getText()).toBe('/p')
  })
})

describe('explicit command discovery loading', () => {
  function startColdQuery() {
    let finish!: (changed: boolean) => void
    mocks.refresh.mockImplementation((_target, onQuery) => {
      onQuery()
      return new Promise((resolve) => {
        finish = resolve
      })
    })
    mocks.getCachedCommands.mockResolvedValue([])
    context = { kind: 1 }
    createEditor({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'mention', attrs: { id: npub, label: 'Bot' } },
            { type: 'text', text: ' ' }
          ]
        }
      ]
    })
    editor.commands.setTextSelection(3)
    editor.commands.insertContent('/')
    return { finish }
  }

  it('displays loading on a cold real query and hides it on an empty response', async () => {
    const { finish } = startColdQuery()
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.onMenu).toHaveBeenLastCalledWith(true, [])
    expect(mocks.onPopupVisible).toHaveBeenLastCalledWith(true)
    finish(false)
    await vi.advanceTimersByTimeAsync(180)
    expect(mocks.onPopupVisible).toHaveBeenLastCalledWith(false)
    expect(editor.getText()).toContain('/')
  })

  it.each(['Escape', 'blur'])(
    'does not reopen after %s while the request is pending',
    async (dismiss) => {
      const { finish } = startColdQuery()
      await vi.advanceTimersByTimeAsync(180)
      expect(mocks.onMenu).toHaveBeenLastCalledWith(true, [])
      if (dismiss === 'Escape') {
        expect(key('Escape')).toBe(false)
      } else {
        const button = document.createElement('button')
        container.append(button)
        button.focus()
      }
      expect(mocks.onPopupVisible).toHaveBeenLastCalledWith(false)
      mocks.getCachedCommands.mockResolvedValue([ping])
      mocks.onPopupVisible.mockClear()
      finish(true)
      await vi.advanceTimersByTimeAsync(180)
      expect(mocks.onPopupVisible).not.toHaveBeenCalledWith(true)
    }
  )
})

describe('qualified command styling', () => {
  it('styles a pasted head but preserves its arguments, clipboard and text representation', () => {
    createEditor()
    const head = formatNipCdInvocation(ping)
    const text = head + ' hello 世界'
    expect(editor.view.pasteText(text, new Event('paste') as ClipboardEvent)).toBe(true)
    expect(invocation()).toBe(head)
    expect(editor.view.dom.querySelector('p')?.lastChild?.textContent).toBe(' hello 世界')
    expect(editor.getJSON().content?.[0].content).toEqual([{ type: 'text', text }])
    editor.commands.selectAll()
    const copy = editor.view.serializeForClipboard(editor.state.selection.content())
    expect(copy.text).toBe(text)
    expect(copy.dom.querySelector('.nip-cd-invocation')).toBeNull()
  })

  it('styles a completed typed command and removes the style when the qualifier is edited', () => {
    createEditor()
    const head = formatNipCdInvocation({ ...ping, command: '回应' })
    editor.commands.insertContent(head.slice(0, -1))
    expect(invocation()).toBeUndefined()
    editor.commands.insertContent(head.slice(-1))
    expect(invocation()).toBe(head)
    editor.view.dispatch(editor.state.tr.delete(head.length, head.length + 1))
    expect(invocation()).toBeUndefined()
    expect(editor.getText()).toBe(head.slice(0, -1))
  })

  it.each(['/ping', 'prefix ', ' ', '/ping@nostr:npub1bad', 'first paragraph\n'])(
    'does not style ordinary, malformed, or noninitial text (%s)',
    (prefix) => {
      createEditor()
      const text =
        prefix.endsWith(' ') || prefix.endsWith('\n')
          ? prefix + formatNipCdInvocation(ping)
          : prefix
      editor.view.pasteText(text, new Event('paste') as ClipboardEvent)
      expect(invocation()).toBeUndefined()
    }
  )
})
