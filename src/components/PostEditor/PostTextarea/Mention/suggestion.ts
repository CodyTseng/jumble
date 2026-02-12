import client from '@/services/client.service'
import postEditor from '@/services/post-editor.service'
import type { Editor } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import { SuggestionKeyDownProps } from '@tiptap/suggestion'
import tippy, { GetReferenceClientRect, Instance, Props } from 'tippy.js'
import { getDefaultRelayUrls } from '@/lib/relay'
import { getNoteBech32Id } from '@/lib/event'
import { tagNameEquals } from '@/lib/tag'
import MentionList, { MentionListHandle, MentionListProps, TMentionSuggestionItem } from './MentionList'

const PEOPLE_LIST_KIND = 30000

let cachedListPubkey: string | undefined
let cachedLists: TMentionSuggestionItem[] = []
let cachedListsAt = 0

async function getPeopleListsFromCache(): Promise<TMentionSuggestionItem[]> {
  const pubkey = client.pubkey
  if (!pubkey) return []

  const now = Date.now()
  if (cachedListPubkey === pubkey && now - cachedListsAt < 5 * 60 * 1000) {
    return cachedLists
  }

  cachedListPubkey = pubkey
  cachedListsAt = now
  cachedLists = []

  try {
    const relayList = await client.fetchRelayList(pubkey)
    const relayUrls = (relayList.write ?? []).concat(getDefaultRelayUrls()).slice(0, 4)
    const events = await client.fetchEvents(relayUrls, {
      authors: [pubkey],
      kinds: [PEOPLE_LIST_KIND],
      limit: 50
    })

    // Replaceable: keep newest per (pubkey,d).
    const byKey = new Map<string, (typeof events)[number]>()
    for (const evt of events.sort((a, b) => b.created_at - a.created_at)) {
      const d = evt.tags.find(tagNameEquals('d'))?.[1] ?? ''
      const key = `${evt.pubkey}:${d}`
      if (!byKey.has(key)) {
        byKey.set(key, evt)
      }
      client.addEventToCache(evt)
    }

    cachedLists = Array.from(byKey.values()).map((evt) => {
      const title =
        evt.tags.find(tagNameEquals('title'))?.[1] ??
        evt.tags.find(tagNameEquals('name'))?.[1] ??
        evt.tags.find(tagNameEquals('d'))?.[1] ??
        'List'
      const count = evt.tags.filter(tagNameEquals('p')).length
      const id = getNoteBech32Id(evt)
      return { type: 'list', id, title, count } as TMentionSuggestionItem
    })
  } catch {
    // Non-fatal: suggestions should still work for profiles.
    cachedLists = []
  }

  return cachedLists
}

const suggestion = {
  items: async ({ query }: { query: string }) => {
    const q = query.trim().toLowerCase()

    const [npubs, lists] = await Promise.all([
      client.searchNpubsFromLocal(query, 20),
      getPeopleListsFromCache()
    ])

    const profileItems: TMentionSuggestionItem[] = npubs.map((id) => ({ type: 'profile', id }))
    const listItems: TMentionSuggestionItem[] =
      q.length === 0
        ? lists.slice(0, 20)
        : lists
            .filter((item) => item.type === 'list' && item.title.toLowerCase().includes(q))
            .slice(0, 20)

    return profileItems.concat(listItems)
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
