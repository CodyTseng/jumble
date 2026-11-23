import {
  formatNipCdInvocation,
  getNipCdMentionPubkey,
  matchesNipCdScope,
  TNipCdCommand,
  TNipCdContext
} from '@/lib/nip-cd'
import nipCdService from '@/services/nip-cd.service'
import postEditor from '@/services/post-editor.service'
import { Extension, type Editor } from '@tiptap/core'
import type { ResolvedPos } from '@tiptap/pm/model'
import { PluginKey } from '@tiptap/pm/state'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, { exitSuggestion, type SuggestionProps } from '@tiptap/suggestion'
import tippy, { type Instance } from 'tippy.js'
import CommandList, {
  TCommandListHandle,
  TCommandListProps,
  TNipCdSuggestionItem
} from './CommandList'

export type TNipCdEditorContext = Pick<TNipCdContext, 'kind' | 'author'> & {
  replyExecutor?: string
}
const pluginKey = new PluginKey('nipCdCommandSuggestion')

function matchesSuggestionScope(command: TNipCdCommand, context: TNipCdEditorContext) {
  // The final event tags and publish targets are only available when sending.
  const scopes = command.scopes.filter(
    ({ group }) => group === 'kind' || (group === 'author' && context.author !== undefined)
  )
  return matchesNipCdScope({ ...command, scopes }, context)
}

export function closeNipCdSuggestion(editor: Editor) {
  if (pluginKey.getState(editor.state)?.active) exitSuggestion(editor.view, pluginKey)
}

/** Bare slash reads the local catalog; selecting an initial mention narrows its executor. */
function findInvocation($position: ResolvedPos) {
  if ($position.depth !== 1 || $position.index(0) !== 0) return
  const first = $position.parent.firstChild
  if (!first) return
  const mention = first.type.name === 'mention' ? first : undefined
  const offset = mention?.nodeSize ?? 0
  if ($position.parentOffset <= offset) return
  const before = $position.parent.textBetween(offset, $position.parentOffset, '\n', '\uFFFC')
  const query = (mention ? /^[ \t]+\/(?!\/)([^\s@]*)$/u : /^\/(?!\/)([^\s@]*)$/u).exec(before)
  if (!query) return
  // Editing inside an existing token is not autocomplete; replacing the prefix
  // alone would leave a mangled qualifier and send to the wrong account.
  const after = $position.parent.textBetween(
    $position.parentOffset,
    $position.parent.content.size,
    '\n',
    '\uFFFC'
  )
  if (after && !/^\s/u.test(after)) return
  const executor =
    mention && typeof mention.attrs.id === 'string'
      ? getNipCdMentionPubkey(mention.attrs.id)
      : undefined
  if (mention && !executor) return
  return {
    range: { from: $position.start(), to: $position.pos },
    query: query[1],
    text: executor ? `${executor}${before}` : before,
    executor,
    after
  }
}

export const NipCdSuggestion = Extension.create<{
  getContext: () => TNipCdEditorContext | undefined
}>({
  name: 'nipCdSuggestion',

  addOptions() {
    return { getContext: () => undefined }
  },

  addProseMirrorPlugins() {
    const { editor } = this
    const { getContext } = this.options
    const loadCachedSuggestions = async (query: string, signal?: AbortSignal) => {
      const context = getContext()
      const invocation = findInvocation(editor.state.selection.$from)
      if (!context || !invocation || invocation.query !== query) return []
      const executor = invocation.executor
      const isCurrent = () => {
        if (signal?.aborted || editor.isDestroyed || context !== getContext()) return false
        const current = findInvocation(editor.state.selection.$from)
        return !!current && current.executor === executor && current.query === query
      }
      const commands = await nipCdService.getCachedCommands(executor)
      if (!isCurrent()) return []
      const prefix = query.toLowerCase()
      const priority = (candidate: string) => Number(candidate === context.replyExecutor)
      const items = commands
        .filter(
          (command) =>
            command.command.toLowerCase().startsWith(prefix) &&
            matchesSuggestionScope(command, context)
        )
        .sort(
          (a, b) =>
            priority(b.executor) - priority(a.executor) ||
            a.command.localeCompare(b.command) ||
            a.executor.localeCompare(b.executor) ||
            a.id.localeCompare(b.id)
        )
        .slice(0, 12)
      const names = await nipCdService.getCachedExecutorNames([
        ...new Set(items.map((item) => item.executor))
      ])
      if (!isCurrent()) return []
      return items.map((item) => ({ ...item, executorName: names.get(item.executor) }))
    }

    return [
      Suggestion<TNipCdSuggestionItem>({
        editor,
        pluginKey,
        char: '/',
        decorationClass: 'nip-cd-suggestion',
        dismissOnOutsideClick: false,
        debounce: 120,
        findSuggestionMatch: ({ $position }) => findInvocation($position) ?? null,
        allow: () => !!getContext(),
        items: ({ query, signal }) => loadCachedSuggestions(query, signal),
        command: ({ range, props: item }) => {
          const context = getContext()
          const current = findInvocation(editor.state.selection.$from)
          if (
            !context ||
            !current ||
            (current.executor !== undefined && current.executor !== item.executor) ||
            current.range.from !== range.from ||
            current.range.to !== range.to ||
            !item.command.toLowerCase().startsWith(current.query.toLowerCase()) ||
            !matchesSuggestionScope(item, context)
          )
            return
          const hasSeparator = current.after.startsWith(' ')
          const text = formatNipCdInvocation(item) + (hasSeparator ? '' : ' ')
          const chain = editor.chain().focus().insertContentAt(range, { type: 'text', text })
          if (hasSeparator) chain.setTextSelection(range.from + text.length + 1)
          chain.run()
        },
        render: () => {
          let component: ReactRenderer<TCommandListHandle, TCommandListProps> | undefined
          let popup: Instance | undefined
          let latestProps: SuggestionProps<TNipCdSuggestionItem> | undefined
          const refreshedExecutors = new Set<string>()
          const queryingExecutors = new Set<string>()
          let previousItems: TNipCdSuggestionItem[] = []
          let session = 0

          const close = () => {
            if (!editor.isDestroyed) exitSuggestion(editor.view, pluginKey)
          }
          const update = (props: SuggestionProps<TNipCdSuggestionItem>) => {
            if (editor.isDestroyed || !editor.isFocused) {
              popup?.hide()
              return
            }
            const invocation = findInvocation(editor.state.selection.$from)
            if (!invocation || invocation.query !== props.query) return
            // TipTap clears its items for each debounced local lookup. Keep
            // matching stale rows interactive while the remote refresh runs.
            const items = props.loading
              ? previousItems.filter(
                  (item) =>
                    (!invocation.executor || item.executor === invocation.executor) &&
                    item.command.toLowerCase().startsWith(invocation.query.toLowerCase())
                )
              : props.items
            if (!props.loading) previousItems = items
            const loading = !!invocation.executor && queryingExecutors.has(invocation.executor)
            if ((!items.length && !loading) || !props.clientRect?.()) {
              popup?.hide()
              return
            }
            const clientRect = props.clientRect
            const menuProps = { ...props, items, loading }
            if (!component) {
              component = new ReactRenderer(CommandList, { props: menuProps, editor })
            } else {
              component.updateProps(menuProps)
            }
            if (popup) {
              popup.setProps({ getReferenceClientRect: () => clientRect() ?? new DOMRect() })
              popup.show()
            } else {
              popup = tippy(editor.view.dom, {
                getReferenceClientRect: () => clientRect() ?? new DOMRect(),
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
                hideOnClick: false,
                onClickOutside: close,
                onShow() {
                  postEditor.isSuggestionPopupOpen = true
                },
                onHide() {
                  postEditor.isSuggestionPopupOpen = false
                }
              })
            }
          }

          const refreshSelectedExecutor = (props: SuggestionProps<TNipCdSuggestionItem>) => {
            latestProps = props
            const executor = findInvocation(editor.state.selection.$from)?.executor
            if (!executor || refreshedExecutors.has(executor)) return
            refreshedExecutors.add(executor)
            const owner = session
            const isCurrent = () => owner === session && !editor.isDestroyed && editor.isFocused
            void nipCdService
              .refresh(executor, () => {
                if (!isCurrent()) return
                queryingExecutors.add(executor)
                if (latestProps) update(latestProps)
              })
              .then(async (changed) => {
                if (!isCurrent()) return
                queryingExecutors.delete(executor)
                const snapshot = latestProps
                if (!snapshot) return
                // Clear the indicator even on failures and when the active
                // executor changed before this result arrived.
                update(snapshot)
                if (!changed || findInvocation(editor.state.selection.$from)?.executor !== executor)
                  return
                const items = await loadCachedSuggestions(snapshot.query)
                if (latestProps === snapshot && isCurrent()) {
                  latestProps = { ...snapshot, items, loading: false }
                  update(latestProps)
                }
              })
          }

          return {
            onStart(props) {
              session++
              postEditor.addEventListener('closeSuggestionPopup', close)
              editor.on('blur', close)
              void nipCdService.reloadCachedCatalogs()
              refreshSelectedExecutor(props)
              update(props)
            },
            onUpdate(props) {
              refreshSelectedExecutor(props)
              update(props)
            },
            onKeyDown({ event }) {
              if (!popup?.state.isVisible || event.isComposing || event.keyCode === 229)
                return false
              // TipTap dismisses the suggestion's state itself on Escape.
              if (event.key === 'Escape') return true
              return component?.ref?.onKeyDown(event) ?? false
            },
            onExit() {
              session++
              postEditor.removeEventListener('closeSuggestionPopup', close)
              editor.off('blur', close)
              if (popup?.state.isVisible) postEditor.isSuggestionPopupOpen = false
              popup?.destroy()
              popup = undefined
              latestProps = undefined
              previousItems = []
              refreshedExecutors.clear()
              queryingExecutors.clear()
              component?.destroy()
              component = undefined
            }
          }
        }
      })
    ]
  }
})
