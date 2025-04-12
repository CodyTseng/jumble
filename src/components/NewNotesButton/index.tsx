import React, { useState, useEffect } from 'react'
import UserAvatar from '@/components/UserAvatar'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useDeepBrowsing } from '@/providers/DeepBrowsingProvider'

export type User = {
  pubkey: string
}

interface NewNotesButtonProps {
  users?: User[]
  eventCount?: number
  onShowEvents?: () => void
}

const NewNotesButton: React.FC<NewNotesButtonProps> = ({
  users = [],
  eventCount: initialEventCount = 0,
  onShowEvents
}) => {
  const [newNotesCount, setNewNotesCount] = useState(initialEventCount)
  const { isSmallScreen } = useScreenSize()
  const { deepBrowsing } = useDeepBrowsing()

  useEffect(() => {
    setNewNotesCount(initialEventCount)
  }, [initialEventCount])

  const handleClick = () => {
    if (onShowEvents) {
      onShowEvents()
    } else {
      console.log('Showing new notes...')
    }
    setNewNotesCount(0)
  }

  const getDesktopPosition = () => {
    return deepBrowsing
      ? 'absolute left-0 right-0 top-[3.5rem] w-full flex justify-center z-50'
      : 'absolute left-0 right-0 top-[6.5rem] w-full flex justify-center z-50'
  }

  return (
    <>
      {newNotesCount > 0 && (
        <div
          className={
            isSmallScreen
              ? 'fixed left-0 right-0 w-full flex justify-center z-[9999]'
              : getDesktopPosition()
          }
          style={isSmallScreen ? { bottom: 'calc(4rem + env(safe-area-inset-bottom))' } : undefined}
        >
          <button
            onClick={handleClick}
            className="flex items-center bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-full text-sm font-medium shadow-lg"
          >
            {users && users.length > 0 && (
              <div className="flex items-center mr-1">
                {users.slice(0, 3).map((user, index) => (
                  <div
                    key={user.pubkey}
                    className="relative -mr-2.5 last:mr-0"
                    style={{ zIndex: 3 - index }}
                  >
                    <div className="w-7 h-7 rounded-full border-2 border-purple-600 overflow-hidden flex items-center justify-center bg-background">
                      <UserAvatar userId={user.pubkey} size="small" />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <span className="whitespace-nowrap ml-1">
              Show {newNotesCount > 99 ? '99+' : newNotesCount} new events
            </span>
          </button>
        </div>
      )}
    </>
  )
}

export default NewNotesButton
