import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { parseEditorJsonToText } from '@/lib/tiptap'
import { cn } from '@/lib/utils'
import customEmojiService from '@/services/custom-emoji.service'
import { TAccountPointer, TEmoji } from '@/types'
import Document from '@tiptap/extension-document'
import { HardBreak } from '@tiptap/extension-hard-break'
import History from '@tiptap/extension-history'
import Paragraph from '@tiptap/extension-paragraph'
import Placeholder from '@tiptap/extension-placeholder'
import Text from '@tiptap/extension-text'
import { TextSelection } from '@tiptap/pm/state'
import { Content, EditorContent, useEditor } from '@tiptap/react'
import {
  Dispatch,
  forwardRef,
  SetStateAction,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardAndDropHandler } from './ClipboardAndDropHandler'
import Emoji from './Emoji'
import emojiSuggestion from './Emoji/suggestion'
import Mention from './Mention'
import mentionSuggestion from './Mention/suggestion'
import PostAccountSelector from '../PostAccountSelector'
import Preview from './Preview'

export type TPostTextareaHandle = {
  appendText: (text: string, addNewline?: boolean) => void
  insertText: (text: string) => void
  insertEmoji: (emoji: string | TEmoji) => void
  getJSON: () => unknown
}

const PostTextarea = forwardRef<
  TPostTextareaHandle,
  {
    text: string
    setText: Dispatch<SetStateAction<string>>
    initialContent?: Content
    onSubmit?: () => void
    className?: string
    onUploadStart?: (file: File, cancel: () => void) => void
    onUploadProgress?: (file: File, progress: number) => void
    onUploadEnd?: (file: File) => void
    placeholder?: string
    topRightActions?: React.ReactNode
    postAsAccount?: TAccountPointer | null
    onPostAsAccountChange?: (account: TAccountPointer) => void
    previewPubkey?: string
  }
>(
  (
    {
      text = '',
      setText,
      initialContent,
      onSubmit,
      className,
      onUploadStart,
      onUploadProgress,
      onUploadEnd,
      placeholder,
      topRightActions,
      postAsAccount,
      onPostAsAccountChange,
      previewPubkey
    },
    ref
  ) => {
    const { t } = useTranslation()
    const [tabValue, setTabValue] = useState('edit')
    // Keep the tabs and the (mobile) action buttons on one row when they fit;
    // when a long translation would crowd them, stack the buttons above the tabs.
    const headerRef = useRef<HTMLDivElement>(null)
    const tabsRef = useRef<HTMLDivElement>(null)
    const actionsRef = useRef<HTMLDivElement>(null)
    const [stackActions, setStackActions] = useState(false)
    useLayoutEffect(() => {
      const container = headerRef.current
      if (!container) return
      const measure = () => {
        const tabsEl = tabsRef.current
        const actionsEl = actionsRef.current
        if (!tabsEl || !actionsEl) {
          setStackActions(false)
          return
        }
        const GAP = 8
        setStackActions(tabsEl.offsetWidth + actionsEl.offsetWidth + GAP > container.clientWidth)
      }
      measure()
      const ro = new ResizeObserver(measure)
      ro.observe(container)
      if (tabsRef.current) ro.observe(tabsRef.current)
      if (actionsRef.current) ro.observe(actionsRef.current)
      return () => ro.disconnect()
    }, [])
    const editor = useEditor({
      extensions: [
        Document,
        Paragraph,
        Text,
        History,
        HardBreak,
        Placeholder.configure({
          placeholder:
            placeholder ??
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
          class: cn('px-5 py-2 text-base focus-visible:outline-hidden sm:px-6', className)
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
      content: initialContent,
      onUpdate(props) {
        setText(parseEditorJsonToText(props.editor.getJSON()))
      },
      onCreate(props) {
        setText(parseEditorJsonToText(props.editor.getJSON()))
      }
    })

    useImperativeHandle(ref, () => ({
      appendText: (text: string, addNewline = false) => {
        if (!editor || !text) return
        editor
          .chain()
          .focus()
          .command(({ tr, state, dispatch }) => {
            if (!dispatch) return true
            const doc = tr.doc
            const hardBreakType = state.schema.nodes.hardBreak

            // Land inside the LAST textblock, at the end of its content. Using
            // doc.content.size directly would be a between-block position and
            // insertContent there would mint a new paragraph for the URL,
            // showing a paragraph-margin gap above it.
            let lastTextblockEnd = -1
            let lastIsEmpty = false
            let lastEndsWithBr = false
            let offset = 0
            doc.forEach((node) => {
              if (node.isTextblock) {
                lastTextblockEnd = offset + 1 + node.content.size
                lastIsEmpty = node.content.size === 0
                lastEndsWithBr = node.lastChild?.type === hardBreakType
              }
              offset += node.nodeSize
            })

            if (lastTextblockEnd === -1) return true

            const nodes = []
            if (!lastIsEmpty && !lastEndsWithBr) nodes.push(hardBreakType.create())
            nodes.push(state.schema.text(text))
            if (addNewline) nodes.push(hardBreakType.create())
            tr.insert(lastTextblockEnd, nodes)
            const insertedSize = nodes.reduce((acc, n) => acc + n.nodeSize, 0)
            tr.setSelection(TextSelection.create(tr.doc, lastTextblockEnd + insertedSize))
            dispatch(tr)
            return true
          })
          .run()
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
            editor.chain().insertContent(emojiNode).run()
          }
        }
      },
      getJSON: () => editor?.getJSON() ?? null
    }))

    if (!editor) {
      return null
    }

    return (
      <Tabs defaultValue="edit" value={tabValue} onValueChange={(v) => setTabValue(v)}>
        <div className="px-5 pt-3 sm:px-6">
          <div
            ref={headerRef}
            className={cn('flex gap-2', stackActions ? 'flex-col-reverse gap-1' : 'items-center')}
          >
            <div ref={tabsRef} className={stackActions ? 'self-start' : ''}>
              <TabsList className="h-auto gap-1 bg-transparent p-0">
                <TabsTrigger
                  value="edit"
                  className="h-8 rounded-md bg-transparent px-2.5 text-sm text-muted-foreground shadow-none hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {t('Edit')}
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="h-8 rounded-md bg-transparent px-2.5 text-sm text-muted-foreground shadow-none hover:text-foreground data-[state=active]:bg-muted data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  {t('Preview')}
                </TabsTrigger>
              </TabsList>
            </div>
            {topRightActions && (
              <div
                ref={actionsRef}
                className={cn('sm:hidden', stackActions ? 'self-end' : 'ms-auto')}
              >
                {topRightActions}
              </div>
            )}
          </div>
        </div>
        <TabsContent value="edit" className="mt-0">
          {postAsAccount && onPostAsAccountChange && (
            <PostAccountSelector value={postAsAccount} onChange={onPostAsAccountChange} />
          )}
          <EditorContent className="tiptap" editor={editor} />
        </TabsContent>
        <TabsContent
          value="preview"
          className="mt-0"
          onClick={() => {
            setTabValue('edit')
            editor.commands.focus()
          }}
        >
          <Preview content={text} pubkey={previewPubkey} className={className} />
        </TabsContent>
      </Tabs>
    )
  }
)
PostTextarea.displayName = 'PostTextarea'
export default PostTextarea
