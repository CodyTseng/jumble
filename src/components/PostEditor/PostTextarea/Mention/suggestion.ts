import client from '@/services/client.service'
import postEditor from '@/services/post-editor.service'
import type { Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import tippy, { GetReferenceClientRect, Instance, Props } from 'tippy.js'
import MentionList, {
  MentionListHandle,
  MentionListProps,
  TMentionSuggestionItem
} from './MentionList'

const suggestion = {
  items: async ({ query }: { query: string }) => {
    const [profiles, peopleLists] = await Promise.all([
      client.searchNpubsFromLocal(query, 20),
      client.searchPeopleLists(query, 10)
    ])

    return [
      ...profiles.map((id) => ({ type: 'profile', id }) as TMentionSuggestionItem),
      ...peopleLists.map(
        (list) =>
          ({
            type: 'people-list',
            id: list.naddr,
            title: list.title,
            author: list.author,
            count: list.pubkeys.length
          }) as TMentionSuggestionItem
      )
    ]
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
