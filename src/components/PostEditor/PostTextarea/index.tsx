import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseEditorJsonToText } from '@/lib/tiptap'
import { cn } from '@/lib/utils'
import customEmojiService from '@/services/custom-emoji.service'
import postEditorCache from '@/services/post-editor-cache.service'
import { TEmoji } from '@/types'
import Document from '@tiptap/extension-document'
import { HardBreak } from '@tiptap/extension-hard-break'
import History from '@tiptap/extension-history'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Text from '@tiptap/extension-text'
import { TextSelection } from '@tiptap/pm/state'
import { EditorContent, useEditor } from '@tiptap/react'
import { Event } from 'nostr-tools'
import { Dispatch, forwardRef, SetStateAction, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardAndDropHandler } from './ClipboardAndDropHandler'
import Emoji from './Emoji'
import emojiSuggestion from './Emoji/suggestion'
import Mention from './Mention'
import mentionSuggestion from './Mention/suggestion'
import Preview from './Preview'

export type TPostTextareaHandle = {
  appendText: (text: string, addNewline?: boolean) => void
  insertText: (text: string) => void
  insertEmoji: (emoji: string | TEmoji) => void
}

const PostTextarea = forwardRef<
  TPostTextareaHandle,
  {
    text: string
    setText: Dispatch<SetStateAction<string>>
    defaultContent?: string
    parentEvent?: Event
    onSubmit?: () => void
    className?: string
    onUploadStart?: (file: File, cancel: () => void) => void
    onUploadProgress?: (file: File, progress: number) => void
    onUploadEnd?: (file: File) => void
  }
>(
  (
    {
      text = '',
      setText,
      defaultContent,
      parentEvent,
      onSubmit,
      className,
      onUploadStart,
      onUploadProgress,
      onUploadEnd
    },
    ref
  ) => {
    const { t } = useTranslation()
    const [tabValue, setTabValue] = useState('edit')
    const editor = useEditor({
      extensions: [
        Document,
        Paragraph,
        Text,
        History,
        HardBreak,
        Placeholder.configure({
          placeholder:
            t('Write something...') + ' (' + t('Paste or drop media files to upload') + ')'
        }),
        Emoji.configure({
          suggestion: emojiSuggestion
        }),
        Mention.configure({
          suggestion: mentionSuggestion
        }),
        ClipboardAndDropHandler.configure({
          onUploadStart: (file, cancel) => {
            onUploadStart?.(file, cancel)
          },
          onUploadEnd: (file) => onUploadEnd?.(file),
          onUploadProgress: (file, p) => onUploadProgress?.(file, p)
        })
      ],
      editorProps: {
        attributes: {
          class: cn(
            'border rounded-lg p-3 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className
          )
        },
        handleKeyDown: (_view, event) => {
          // Handle Ctrl+Enter or Cmd+Enter for submit
          if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault()
            onSubmit?.()
            return true
          }
          return false
        },
        clipboardTextSerializer(content) {
          return parseEditorJsonToText(content.toJSON())
        }
      },
      content: postEditorCache.getPostContentCache({ defaultContent, parentEvent }),
      onUpdate(props) {
        setText(parseEditorJsonToText(props.editor.getJSON()))
        postEditorCache.setPostContentCache({ defaultContent, parentEvent }, props.editor.getJSON())
      },
      onCreate(props) {
        setText(parseEditorJsonToText(props.editor.getJSON()))
      }
    })

    useImperativeHandle(ref, () => ({
      appendText: (text: string, addNewline = false) => {
        if (editor) {
          let chain = editor
            .chain()
            .focus()
            .command(({ tr, dispatch }) => {
              if (dispatch) {
                const endPos = tr.doc.content.size
                const selection = TextSelection.create(tr.doc, endPos)
                tr.setSelection(selection)
                dispatch(tr)
              }
              return true
            })
            .insertContent(text)
          if (addNewline) {
            chain = chain.setHardBreak()
          }
          chain.run()
        }
      },
      insertText: (text: string) => {
        if (editor) {
          editor.chain().focus().insertContent(text).run()
        }
      },
      insertEmoji: (emoji: string | TEmoji) => {
        if (editor) {
          if (typeof emoji === 'string') {
            editor.chain().insertContent(emoji).run()
          } else {
            const emojiNode = editor.schema.nodes.emoji.create({
              name: customEmojiService.getEmojiId(emoji)
            })
            editor.chain().insertContent(emojiNode).insertContent(' ').run()
          }
        }
      }
    }))

    if (!editor) {
      return null
    }

    return (
      <Tabs
        defaultValue="edit"
        value={tabValue}
        onValueChange={(v) => setTabValue(v)}
        className="space-y-2"
      >
        <TabsList>
          <TabsTrigger value="edit">{t('Edit')}</TabsTrigger>
          <TabsTrigger value="preview">{t('Preview')}</TabsTrigger>
        </TabsList>
        <TabsContent value="edit">
          <EditorContent className="tiptap" editor={editor} />
        </TabsContent>
        <TabsContent
          value="preview"
          onClick={() => {
            setTabValue('edit')
            editor.commands.focus()
          }}
        >
          <Preview content={text} className={className} />
        </TabsContent>
      </Tabs>
    )
  }
)
PostTextarea.displayName = 'PostTextarea'
export default PostTextarea
