import { TRelayGroup } from '@/types'
import { checkAlgoRelay, checkSearchRelay } from '@/lib/relay'
import { isWebsocketUrl, normalizeUrl } from '@/lib/url'
import client from '@/services/client.service'
import storage from '@/services/storage.service'
import { createContext, Dispatch, useContext, useEffect, useState } from 'react'

type TRelaySettingsContext = {
  relayGroups: TRelayGroup[]
  temporaryRelayUrls: string[]
  relayUrls: string[]
  searchableRelayUrls: string[]
  areAlgoRelays: boolean
  switchRelayGroup: (groupName: string) => void
  renameRelayGroup: (oldGroupName: string, newGroupName: string) => string | null
  deleteRelayGroup: (groupName: string) => void
  addRelayGroup: (groupName: string, relayUrls?: string[]) => string | null
  updateRelayGroupRelayUrls: (groupName: string, relayUrls: string[]) => void
  setTemporaryRelayUrls: Dispatch<string[]>
}

const RelaySettingsContext = createContext<TRelaySettingsContext | undefined>(undefined)

export const useRelaySettings = () => {
  const context = useContext(RelaySettingsContext)
  if (!context) {
    throw new Error('useRelaySettings must be used within a RelaySettingsProvider')
  }
  return context
}

export function RelaySettingsProvider({ children }: { children: React.ReactNode }) {
  const [relayGroups, setRelayGroups] = useState<TRelayGroup[]>([])
  const [temporaryRelayUrls, setTemporaryRelayUrls] = useState<string[]>([])
  const [relayUrls, setRelayUrls] = useState<string[]>(
    temporaryRelayUrls.length
      ? temporaryRelayUrls
      : (relayGroups.find((group) => group.isActive)?.relayUrls ?? [])
  )
  const [searchableRelayUrls, setSearchableRelayUrls] = useState<string[]>([])
  const [areAlgoRelays, setAreAlgoRelays] = useState(false)

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const tempRelays = searchParams
      .getAll('r')
      .filter((url) => isWebsocketUrl(url))
      .map((url) => normalizeUrl(url))
    if (tempRelays.length) {
      setTemporaryRelayUrls(tempRelays)
    }
    const storedGroups = storage.getRelayGroups()
    setRelayGroups(storedGroups)
  }, [])

  useEffect(() => {
    const handler = async () => {
      const newRelayUrls = temporaryRelayUrls.length
        ? temporaryRelayUrls
        : (relayGroups.find((group) => group.isActive)?.relayUrls ?? [])

      if (JSON.stringify(relayUrls) !== JSON.stringify(newRelayUrls)) {
        setRelayUrls(newRelayUrls)
      }
      const relayInfos = await client.fetchRelayInfos(newRelayUrls)
      setSearchableRelayUrls(newRelayUrls.filter((_, index) => checkSearchRelay(relayInfos[index])))
      const nonAlgoRelayUrls = newRelayUrls.filter((_, index) => !checkAlgoRelay(relayInfos[index]))
      setAreAlgoRelays(newRelayUrls.length > 0 && nonAlgoRelayUrls.length === 0)
      client.setCurrentRelayUrls(nonAlgoRelayUrls)
    }
    handler()
  }, [relayGroups, temporaryRelayUrls, relayUrls])

  const updateGroups = (fn: (pre: TRelayGroup[]) => TRelayGroup[]) => {
    let newGroups = relayGroups
    setRelayGroups((pre) => {
      newGroups = fn(pre)
      return newGroups
    })
    storage.setRelayGroups(newGroups)
  }

  const switchRelayGroup = (groupName: string) => {
    updateGroups((pre) =>
      pre.map((group) => ({
        ...group,
        isActive: group.groupName === groupName
      }))
    )
    setTemporaryRelayUrls([])
  }

  const deleteRelayGroup = (groupName: string) => {
    updateGroups((pre) => pre.filter((group) => group.groupName !== groupName))
  }

  const updateRelayGroupRelayUrls = (groupName: string, relayUrls: string[]) => {
    updateGroups((pre) =>
      pre.map((group) => ({
        ...group,
        relayUrls: group.groupName === groupName ? relayUrls : group.relayUrls
      }))
    )
  }

  const renameRelayGroup = (oldGroupName: string, newGroupName: string) => {
    if (newGroupName === '') {
      return null
    }
    if (oldGroupName === newGroupName) {
      return null
    }
    updateGroups((pre) => {
      if (pre.some((group) => group.groupName === newGroupName)) {
        return pre
      }
      return pre.map((group) => ({
        ...group,
        groupName: group.groupName === oldGroupName ? newGroupName : group.groupName
      }))
    })
    return null
  }

  const addRelayGroup = (groupName: string, relayUrls: string[] = []) => {
    if (groupName === '') {
      return null
    }
    const normalizedUrls = relayUrls
      .filter((url) => isWebsocketUrl(url))
      .map((url) => normalizeUrl(url))
    updateGroups((pre) => {
      if (pre.some((group) => group.groupName === groupName)) {
        return pre
      }
      return [
        ...pre,
        {
          groupName,
          relayUrls: normalizedUrls,
          isActive: false
        }
      ]
    })
    return null
  }

  return (
    <RelaySettingsContext.Provider
      value={{
        relayGroups,
        temporaryRelayUrls,
        relayUrls,
        searchableRelayUrls,
        areAlgoRelays,
        switchRelayGroup,
        renameRelayGroup,
        deleteRelayGroup,
        addRelayGroup,
        updateRelayGroupRelayUrls,
        setTemporaryRelayUrls
      }}
    >
      {children}
    </RelaySettingsContext.Provider>
  )
}
