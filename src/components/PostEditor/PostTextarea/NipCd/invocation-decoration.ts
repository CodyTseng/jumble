import { getNipCdExecutor } from '@/lib/nip-cd'
import { Extension } from '@tiptap/core'
import type { Node } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const decorationKey = new PluginKey<DecorationSet>('nipCdInvocationDecoration')

function decorations(doc: Node) {
  const firstBlock = doc.firstChild
  if (!firstBlock?.isTextblock) return DecorationSet.empty

  // The document starts with a paragraph. Atoms are not part of a plain-text
  // command head; a hard break does count as a separator before arguments.
  const text = firstBlock.textBetween(0, firstBlock.content.size, '', (node) =>
    node.type.name === 'hardBreak' ? '\n' : '\uFFFC'
  )
  const [head] = text.split(/\s/u, 1)
  if (head.includes('\uFFFC') || !getNipCdExecutor(head)) return DecorationSet.empty

  return DecorationSet.create(doc, [
    Decoration.inline(1, 1 + head.length, { class: 'nip-cd-invocation' })
  ])
}

/** Presentation only; the underlying document, clipboard and event stay plain text. */
export const NipCdInvocationDecoration = Extension.create({
  name: 'nipCdInvocationDecoration',
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: decorationKey,
        state: {
          init: (_, state) => decorations(state.doc),
          apply: (transaction, current) =>
            transaction.docChanged ? decorations(transaction.doc) : current
        },
        props: {
          decorations: (state) => decorationKey.getState(state)
        }
      })
    ]
  }
})
