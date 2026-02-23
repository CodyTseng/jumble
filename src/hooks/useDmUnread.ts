import { useNostr } from '@/providers/NostrProvider'
import dmService from '@/services/dm.service'
import { useCallback, useEffect, useState } from 'react'

export function useDmUnread() {
  const { pubkey } = useNostr()
  const [unreadCount, setUnreadCount] = useState(0)

  const check = useCallback(async () => {
    if (!pubkey) {
      setUnreadCount(0)
      return
    }
    const conversations = await dmService.getConversations(pubkey)
    const total = conversations.reduce((sum, c) => sum + c.unreadCount, 0)
    setUnreadCount(total)
  }, [pubkey])

  useEffect(() => {
    check()
    const unsub = dmService.onDataChanged(check)
    return unsub
  }, [check])

  return { hasUnread: unreadCount > 0, unreadCount }
}
