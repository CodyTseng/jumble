export type TProfile = {
  username: string
  pubkey?: string
  banner?: string
  avatar?: string
  nip05?: string
  about?: string
}

export type TRelayList = {
  write: string[]
  read: string[]
}
