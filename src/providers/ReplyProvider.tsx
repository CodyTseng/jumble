import { getParentATag, getParentETag, getRootATag, getRootETag } from '@/lib/event'
import { Event } from 'nostr-tools'
import { createContext, useCallback, useContext, useState } from 'react'

type TReplyContext = {
  repliesMap: Map<string, { events: Event[]; eventIdSet: Set<string> }>
  addReplies: (replies: Event[]) => void
}

const ReplyContext = createContext<TReplyContext | undefined>(undefined)

export const useReply = () => {
  const context = useContext(ReplyContext)
  if (!context) {
    throw new Error('useReply must be used within a ReplyProvider')
  }
  return context
}

export function ReplyProvider({ children }: { children: React.ReactNode }) {
  const [repliesMap, setRepliesMap] = useState<
    Map<string, { events: Event[]; eventIdSet: Set<string> }>
  >(new Map())

  const addReplies = useCallback((replies: Event[]) => {
    const newReplyIdSet = new Set<string>()
    const newReplyEventMap = new Map<string, Event[]>()
    replies.forEach((reply) => {
      if (newReplyIdSet.has(reply.id)) return
      newReplyIdSet.add(reply.id)

      let rootId: string | undefined
      const rootETag = getRootETag(reply)
      if (rootETag) {
        rootId = rootETag[1]
      } else {
        const rootATag = getRootATag(reply)
        if (rootATag) {
          rootId = rootATag[1]
        }
      }
      if (rootId) {
        newReplyEventMap.set(rootId, [...(newReplyEventMap.get(rootId) || []), reply])
      }

      let parentId: string | undefined
      const parentETag = getParentETag(reply)
      if (parentETag) {
        parentId = parentETag[1]
      } else {
        const parentATag = getParentATag(reply)
        if (parentATag) {
          parentId = parentATag[1]
        }
      }
      if (parentId && parentId !== rootId) {
        newReplyEventMap.set(parentId, [...(newReplyEventMap.get(parentId) || []), reply])
      }
    })
    if (newReplyEventMap.size === 0) return

    setRepliesMap((prev) => {
      for (const [id, newReplyEvents] of newReplyEventMap.entries()) {
        const replies = prev.get(id) || { events: [], eventIdSet: new Set() }
        newReplyEvents.forEach((reply) => {
          if (!replies.eventIdSet.has(reply.id)) {
            replies.events.push(reply)
            replies.eventIdSet.add(reply.id)
          }
        })
        prev.set(id, replies)
      }
      return new Map(prev)
    })
  }, [])

  return (
    <ReplyContext.Provider
      value={{
        repliesMap,
        addReplies
      }}
    >
      {children}
    </ReplyContext.Provider>
  )
}
