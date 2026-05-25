import client from '@/services/client.service'
import postEditor from '@/services/post-editor.service'
import type { Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { Range } from '@tiptap/core'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import tippy, { GetReferenceClientRect, Instance, Props } from 'tippy.js'
import MentionList, { MentionListHandle, MentionListItem, MentionListProps } from './MentionList'

const naddrRegex = /^(?:nostr:)?naddr1[0-9a-z]+$/i

const suggestion = {
  items: async ({ query }: { query: string }) => {
    const profileItems = (await client.searchNpubsFromLocal(query, 20)).map(
      (npub): MentionListItem => ({
        type: 'profile',
        id: npub
      })
    )

    if (!naddrRegex.test(query)) {
      const lists = await client.searchNostrLists(query, 5)
      return [
        ...lists.map(
          (list): MentionListItem => ({
            type: 'list',
            id: list.id,
            label: list.title,
            npubs: list.npubs
          })
        ),
        ...profileItems
      ]
    }

    const list = await client.fetchNostrListFromNaddr(query).catch(() => null)
    if (!list || list.npubs.length === 0) {
      return profileItems
    }

    return [
      {
        type: 'list',
        id: list.id,
        label: list.title,
        npubs: list.npubs
      } satisfies MentionListItem,
      ...profileItems
    ]
  },

  command: ({
    editor,
    range,
    props
  }: {
    editor: Editor
    range: Range
    props: unknown
  }) => {
    const item = props as MentionListItem
    const npubs = item.type === 'list' ? item.npubs : [item.id]
    editor
      .chain()
      .focus()
      .insertContentAt(
        range,
        npubs.flatMap((npub) => [
          {
            type: 'mention',
            attrs: {
              id: npub,
              label: npub
            }
          },
          {
            type: 'text',
            text: ' '
          }
        ])
      )
      .run()
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
