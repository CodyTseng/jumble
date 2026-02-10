import client from '@/services/client.service'
import postEditor from '@/services/post-editor.service'
import { formatNpub } from '@/lib/pubkey'
import type { Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import tippy, { GetReferenceClientRect, Instance, Props } from 'tippy.js'
import MentionList, { MentionListHandle, MentionListProps } from './MentionList'

export type TMentionSuggestionItem =
  | { kind: 'profile'; id: string }
  | { kind: 'list'; name: string; members: string[]; naddr?: string }

const suggestion: any = {
  items: async ({ query }: { query: string }): Promise<TMentionSuggestionItem[]> => {
    const [profiles, lists] = await Promise.all([
      client.searchNpubsFromLocal(query, 20),
      client.searchPeopleListsFromLocal(query, 20)
    ])

    return [
      ...profiles.map((id) => ({ kind: 'profile' as const, id })),
      ...(lists as TMentionSuggestionItem[])
    ]
  },

  command: ({ editor, range, props }: { editor: Editor; range: { from: number; to: number }; props: any }) => {
    const item = props as TMentionSuggestionItem
    if (item.kind === 'profile') {
      editor
        .chain()
        .focus()
        .insertContentAt(range, [
          { type: 'mention', attrs: { id: item.id, label: formatNpub(item.id) } },
          { type: 'text', text: ' ' }
        ])
        .run()
      return
    }

    // Insert a visible list marker plus the expanded mentions.
    const nodes: Array<{ type: string; attrs?: Record<string, unknown>; text?: string }> = [
      { type: 'text', text: `@${item.name} ` }
    ]
    Array.from(new Set(item.members)).forEach((member) => {
      nodes.push({ type: 'mention', attrs: { id: member, label: formatNpub(member) } })
      nodes.push({ type: 'text', text: ' ' })
    })

    editor.chain().focus().insertContentAt(range, nodes).run()
  },

  render: () => {
    let component: ReactRenderer<MentionListHandle, MentionListProps> | undefined
    let popup: Instance[] = []
    let touchListener: (e: TouchEvent) => void
    let closePopup: () => void

    return {
      onBeforeStart: () => {
        touchListener = (e: TouchEvent) => {
          if (popup && popup[0] && postEditor.isSuggestionPopupOpen) {
            const popupElement = popup[0].popper
            if (popupElement && !popupElement.contains(e.target as Node)) {
              popup[0].hide()
            }
          }
        }
        document.addEventListener('touchstart', touchListener)

        closePopup = () => {
          if (popup && popup[0]) {
            popup[0].hide()
          }
        }
        postEditor.addEventListener('closeSuggestionPopup', closePopup)
      },
      onStart: (props: { editor: Editor; clientRect?: (() => DOMRect | null) | null }) => {
        component = new ReactRenderer(MentionList, {
          props,
          editor: props.editor
        })

        if (!props.clientRect) {
          return
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as GetReferenceClientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          hideOnClick: true,
          touch: true,
          onShow() {
            postEditor.isSuggestionPopupOpen = true
          },
          onHide() {
            postEditor.isSuggestionPopupOpen = false
          }
        })
      },

      onUpdate(props: { clientRect?: (() => DOMRect | null) | null | undefined }) {
        component?.updateProps(props)

        if (!props.clientRect) {
          return
        }

        popup[0]?.setProps({
          getReferenceClientRect: props.clientRect
        } as Partial<Props>)
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          popup[0]?.hide()
          return true
        }
        return component?.ref?.onKeyDown(props) ?? false
      },

      onExit() {
        postEditor.isSuggestionPopupOpen = false
        popup[0]?.destroy()
        component?.destroy()

        document.removeEventListener('touchstart', touchListener)
        postEditor.removeEventListener('closeSuggestionPopup', closePopup)
      }
    }
  }
}

export default suggestion
