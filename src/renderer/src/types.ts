export type TEventStats = {
  reactionCount: number
  repostCount: number
  replyCount: number
  hasLiked: boolean
  hasReposted: boolean
}

export type TProfile = {
  username: string
  pubkey?: string
  banner?: string
  avatar?: string
  nip05?: string
  about?: string
}
