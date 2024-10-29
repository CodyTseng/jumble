export type TRelayGroup = {
  groupName: string
  relayUrls: string[]
  isActive: boolean
}

export type TConfig = {
  relayGroups: TRelayGroup[]
}
