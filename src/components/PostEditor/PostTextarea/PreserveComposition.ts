import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

export const PreserveComposition = Extension.create({
  name: 'preserveComposition',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        filterTransaction: (transaction) => {
          // Reading an IME deletion invokes TipTap's Backspace commands. Even
          // commands that return false dispatch empty transactions, which can
          // redraw the old document over the IME's pending DOM edit and cancel
          // composition. Let the original DOM change reach the document first.
          return !(
            this.editor.view.composing &&
            transaction.isGeneric &&
            !transaction.docChanged &&
            !transaction.selectionSet &&
            !transaction.storedMarksSet &&
            !transaction.scrolledIntoView
          )
        }
      })
    ]
  }
})
