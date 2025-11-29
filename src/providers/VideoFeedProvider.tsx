import { createContext, useContext, ReactNode } from 'react'

type TVideoFeedContext = {
  isVideoFeed: boolean
}

const VideoFeedContext = createContext<TVideoFeedContext>({ isVideoFeed: false })

export const useVideoFeed = () => useContext(VideoFeedContext)

export function VideoFeedProvider({
  children,
  isVideoFeed
}: {
  children: ReactNode
  isVideoFeed: boolean
}) {
  return (
    <VideoFeedContext.Provider value={{ isVideoFeed }}>
      {children}
    </VideoFeedContext.Provider>
  )
}
