import mediaUpload from '@/services/media-upload.service'
import { Extension } from '@tiptap/core'
import { EditorView } from '@tiptap/pm/view'
import { Plugin, TextSelection } from 'prosemirror-state'

const DRAGOVER_CLASS_LIST = [
  'outline-2',
  'outline-offset-4',
  'outline-dashed',
  'outline-border',
  'rounded-md'
]

export interface ClipboardAndDropHandlerOptions {
  onUploadStart?: (file: File) => void
  onUploadSuccess?: (file: File, result: any) => void
  onUploadError?: (file: File, error: any) => void
}

export const ClipboardAndDropHandler = Extension.create<ClipboardAndDropHandlerOptions>({
  name: 'clipboardAndDropHandler',

  addOptions() {
    return {
      onUploadStart: undefined,
      onUploadSuccess: undefined,
      onUploadError: undefined
    }
  },

  addProseMirrorPlugins() {
    const options = this.options

    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            dragover(view, event) {
              event.preventDefault()
              view.dom.classList.add(...DRAGOVER_CLASS_LIST)
              return false
            },
            dragleave(view) {
              view.dom.classList.remove(...DRAGOVER_CLASS_LIST)
              return false
            },
            drop(view, event) {
              event.preventDefault()
              view.dom.classList.remove(...DRAGOVER_CLASS_LIST)

              const items = Array.from(event.dataTransfer?.files ?? [])
              const mediaFile = items.find(
                (item) => item.type.includes('image') || item.type.includes('video')
              )
              if (!mediaFile) return false

              uploadFile(view, mediaFile, options)

              return true
            }
          },
          handlePaste(view, event) {
            const items = Array.from(event.clipboardData?.items ?? [])
            let handled = false

            for (const item of items) {
              if (
                item.kind === 'file' &&
                (item.type.includes('image') || item.type.includes('video'))
              ) {
                const file = item.getAsFile()
                if (file) {
                  uploadFile(view, file, options)
                  handled = true
                }
              } else if (item.kind === 'string' && item.type === 'text/plain') {
                item.getAsString((text) => {
                  const { schema } = view.state
                  const parts = text.split('\n')
                  const nodes = []
                  for (let i = 0; i < parts.length; i++) {
                    if (i > 0) nodes.push(schema.nodes.hardBreak.create())
                    if (parts[i]) nodes.push(schema.text(parts[i]))
                  }
                  if (nodes.length > 0) {
                    const tr = view.state.tr.replaceSelectionWith(nodes[0])
                    for (let i = 1; i < nodes.length; i++) {
                      tr.insert(tr.selection.from, nodes[i])
                    }
                    view.dispatch(tr)
                  }
                })
                handled = true
              }

              // Only handle the first file/string item
              if (handled) break
            }
            return handled
          }
        }
      })
    ]
  }
})

async function uploadFile(view: EditorView, file: File, options: ClipboardAndDropHandlerOptions) {
  const name = file.name

  options.onUploadStart?.(file)

  const placeholder = `[Uploading "${name}"...]`
  const uploadingNode = view.state.schema.text(placeholder)
  const hardBreakNode = view.state.schema.nodes.hardBreak.create()
  let tr = view.state.tr.replaceSelectionWith(uploadingNode)
  tr = tr.insert(tr.selection.from, hardBreakNode)
  view.dispatch(tr)

  mediaUpload
    .upload(file)
    .then((result) => {
      options.onUploadSuccess?.(file, result)
      const urlNode = view.state.schema.text(result.url)

      const tr = view.state.tr
      let didReplace = false

      view.state.doc.descendants((node, pos) => {
        if (node.isText && node.text && node.text.includes(placeholder) && !didReplace) {
          const startPos = node.text.indexOf(placeholder)
          const from = pos + startPos
          const to = from + placeholder.length
          tr.replaceWith(from, to, urlNode)
          didReplace = true
          return false
        }
        return true
      })

      if (didReplace) {
        view.dispatch(tr)
      } else {
        const endPos = view.state.doc.content.size

        const paragraphNode = view.state.schema.nodes.paragraph.create(
          null,
          view.state.schema.text(result.url)
        )

        const insertTr = view.state.tr.insert(endPos, paragraphNode)
        const newPos = endPos + 1 + result.url.length
        insertTr.setSelection(TextSelection.near(insertTr.doc.resolve(newPos)))
        view.dispatch(insertTr)
      }
    })
    .catch((error) => {
      console.error('Upload failed:', error)
      options.onUploadError?.(file, error)

      const tr = view.state.tr
      let didReplace = false

      view.state.doc.descendants((node, pos) => {
        if (node.isText && node.text && node.text.includes(placeholder) && !didReplace) {
          const startPos = node.text.indexOf(placeholder)
          const from = pos + startPos
          const to = from + placeholder.length
          const errorNode = view.state.schema.text(`[Error uploading "${name}"]`)
          tr.replaceWith(from, to, errorNode)
          didReplace = true
          return false
        }
        return true
      })

      if (didReplace) {
        view.dispatch(tr)
      }

      throw error
    })
}
