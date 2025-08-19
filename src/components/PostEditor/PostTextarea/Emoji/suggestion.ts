import customEmojiService from '@/services/custom-emoji.service'
import postEditor from '@/services/post-editor.service'
import { computePosition } from '@floating-ui/dom'
import type { Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import tippy, { GetReferenceClientRect, Instance } from 'tippy.js'
import { EmojiList } from './EmojiList'
import { emojis } from '@tiptap/extension-emoji'

interface EmojiListRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean
}

const suggestion = {
  items: async ({ query }: { query: string }) => {
    if (!query) {
      return []
    }
    const buildInEmojis = emojis
      .filter(({ emoji, shortcodes, tags }) => {
        return (
          emoji &&
          (shortcodes.find((shortcode) => shortcode.startsWith(query.toLowerCase())) ||
            tags.find((tag) => tag.startsWith(query.toLowerCase())))
        )
      })
      .slice(0, 20)
    const customEmojis = await customEmojiService.searchEmojis(query)
    return [...customEmojis, ...buildInEmojis]
  },

  allowSpaces: false,
  char: ':',

  render: () => {
    let component: ReactRenderer | null = null
    let popup: Instance[]
    let touchListener: (e: TouchEvent) => void
    let closePopup: () => void

    function repositionComponent(clientRect: DOMRect): void {
      if (!component || !component.element) {
        return
      }

      const virtualElement = {
        getBoundingClientRect() {
          return clientRect
        }
      }

      computePosition(virtualElement, component.element as HTMLElement, {
        placement: 'bottom-start'
      }).then((pos) => {
        if (component) {
          Object.assign((component.element as HTMLElement).style, {
            left: `${pos.x}px`,
            top: `${pos.y}px`,
            position: pos.strategy === 'fixed' ? 'fixed' : 'absolute'
          })
        }
      })
    }

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
        component = new ReactRenderer(EmojiList, {
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

      onUpdate(props: { clientRect?: (() => DOMRect | null) | null }) {
        if (component && props.clientRect) {
          component.updateProps(props)
          repositionComponent(props.clientRect() as ReturnType<GetReferenceClientRect>)
        }
      },

      onKeyDown(props: SuggestionKeyDownProps) {
        if (props.event.key === 'Escape') {
          if (component) {
            document.body.removeChild(component.element)
            component.destroy()
          }
          return true
        }

        return component?.ref &&
          typeof component.ref === 'object' &&
          component.ref &&
          'onKeyDown' in component.ref
          ? (component.ref as EmojiListRef).onKeyDown(props)
          : false
      },

      onExit() {
        if (component) {
          if (document.body.contains(component.element)) {
            document.body.removeChild(component.element)
          }
          component.destroy()
        }
      }
    }
  }
}

export default suggestion
