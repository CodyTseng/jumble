declare global {
  interface Window {
    twttr?: {
      widgets: {
        createTweet: (
          tweetId: string,
          container: HTMLElement,
          options?: {
            theme?: 'light' | 'dark'
            dnt?: boolean
            conversation?: 'none' | 'all'
          }
        ) => Promise<HTMLElement | undefined>
      }
    }
  }
}

export {}
