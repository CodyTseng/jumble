import { DEFAULT_FAVORITE_DOMAINS } from '@/constants'
import { randomString } from '@/lib/random'
import indexedDb from '@/services/indexed-db.service'
import storage from '@/services/local-storage.service'
import nip05CommunityService from '@/services/nip05-community.service'
import { TNip05Community, TNip05CommunitySet } from '@/types'
import { createContext, useContext, useEffect, useState } from 'react'
import CommunitiesOnboardingDialog from '@/components/CommunitiesOnboardingDialog'
import { useNostr } from './NostrProvider'

type TNip05CommunitiesContext = {
  favoriteDomains: string[]
  addFavoriteDomains: (domains: string[]) => void
  deleteFavoriteDomains: (domains: string[]) => void
  reorderFavoriteDomains: (reorderedDomains: string[]) => void
  communitySets: TNip05CommunitySet[]
  createCommunitySet: (name: string, domains?: string[]) => void
  deleteCommunitySet: (id: string) => void
  updateCommunitySet: (set: TNip05CommunitySet) => void
  reorderCommunitySets: (reorderedSets: TNip05CommunitySet[]) => void
  getCommunity: (domain: string) => Promise<TNip05Community | undefined>
  refreshCommunity: (domain: string) => Promise<TNip05Community | undefined>
  isLoading: boolean
}

const Nip05CommunitiesContext = createContext<TNip05CommunitiesContext | undefined>(undefined)

export const useNip05Communities = () => {
  const context = useContext(Nip05CommunitiesContext)
  if (!context) {
    throw new Error('useNip05Communities must be used within a Nip05CommunitiesProvider')
  }
  return context
}

export function Nip05CommunitiesProvider({ children }: { children: React.ReactNode }) {
  const { profile, pubkey } = useNostr()
  const [favoriteDomains, setFavoriteDomains] = useState<string[]>([])
  const [communitySets, setCommunitySets] = useState<TNip05CommunitySet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)

  // Initialize from LocalStorage on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Load favorite domains
        const storedDomains = storage.getFavoriteDomains()
        setFavoriteDomains(storedDomains.length > 0 ? storedDomains : DEFAULT_FAVORITE_DOMAINS)

        // Load community sets
        const storedSets = storage.getNip05CommunitySets()
        setCommunitySets(storedSets)

        // Initialize the nip05CommunityService with cached data from IndexedDB
        await nip05CommunityService.init()

        // Check if user has seen onboarding
        const hasSeenOnboarding = storage.getHasSeenCommunitiesOnboarding()
        if (!hasSeenOnboarding) {
          setShowOnboarding(true)
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error initializing Nip05CommunitiesProvider:', error)
        setIsLoading(false)
      }
    }

    init()
  }, [])

  // Auto-add user's own NIP-05 domain to favorites
  useEffect(() => {
    if (!pubkey || !profile?.nip05 || isLoading) return

    const nip05Parts = profile.nip05.split('@')
    if (nip05Parts.length === 2) {
      const domain = nip05Parts[1].toLowerCase().trim()
      if (domain && !favoriteDomains.includes(domain)) {
        console.log('[Nip05CommunitiesProvider] Auto-adding user NIP-05 domain to favorites:', domain)
        const newDomains = [domain, ...favoriteDomains]
        setFavoriteDomains(newDomains)
        storage.setFavoriteDomains(newDomains)
      }
    }
  }, [pubkey, profile?.nip05, isLoading, favoriteDomains])

  const handleOnboardingClose = (open: boolean) => {
    if (!open) {
      storage.setHasSeenCommunitiesOnboarding(true)
      setShowOnboarding(false)
    }
  }

  // Add domains to favorites
  const addFavoriteDomains = (domains: string[]) => {
    const normalizedDomains = domains
      .map((domain) => domain.toLowerCase().trim())
      .filter((domain) => domain && !favoriteDomains.includes(domain))

    if (!normalizedDomains.length) return

    const newDomains = [...favoriteDomains, ...normalizedDomains]
    setFavoriteDomains(newDomains)
    storage.setFavoriteDomains(newDomains)
  }

  // Remove domains from favorites
  const deleteFavoriteDomains = (domains: string[]) => {
    const normalizedDomains = domains.map((domain) => domain.toLowerCase().trim())

    if (!normalizedDomains.length) return

    const newDomains = favoriteDomains.filter((domain) => !normalizedDomains.includes(domain))
    setFavoriteDomains(newDomains)
    storage.setFavoriteDomains(newDomains)
  }

  // Reorder favorite domains
  const reorderFavoriteDomains = (reorderedDomains: string[]) => {
    setFavoriteDomains(reorderedDomains)
    storage.setFavoriteDomains(reorderedDomains)
  }

  // Create a new community set
  const createCommunitySet = (name: string, domains: string[] = []) => {
    const normalizedDomains = domains.map((domain) => domain.toLowerCase().trim())

    const newSet: TNip05CommunitySet = {
      id: randomString(),
      name,
      domains: normalizedDomains,
      created_at: Date.now()
    }

    const newSets = [...communitySets, newSet]
    setCommunitySets(newSets)
    storage.setNip05CommunitySets(newSets)

    // Store in IndexedDB for persistence
    indexedDb.putNip05CommunitySet(newSet)
  }

  // Delete a community set
  const deleteCommunitySet = (id: string) => {
    const newSets = communitySets.filter((set) => set.id !== id)
    setCommunitySets(newSets)
    storage.setNip05CommunitySets(newSets)

    // Remove from IndexedDB
    indexedDb.deleteNip05CommunitySet(id)
  }

  // Update a community set
  const updateCommunitySet = (updatedSet: TNip05CommunitySet) => {
    const newSets = communitySets.map((set) => (set.id === updatedSet.id ? updatedSet : set))
    setCommunitySets(newSets)
    storage.setNip05CommunitySets(newSets)

    // Update in IndexedDB
    indexedDb.putNip05CommunitySet(updatedSet)
  }

  // Reorder community sets
  const reorderCommunitySets = (reorderedSets: TNip05CommunitySet[]) => {
    setCommunitySets(reorderedSets)
    storage.setNip05CommunitySets(reorderedSets)
  }

  // Get community data (from cache or fetch)
  const getCommunity = async (domain: string): Promise<TNip05Community | undefined> => {
    return await nip05CommunityService.getCommunity(domain)
  }

  // Force refresh community data
  const refreshCommunity = async (domain: string): Promise<TNip05Community | undefined> => {
    return await nip05CommunityService.refreshCommunityMembers(domain)
  }

  return (
    <Nip05CommunitiesContext.Provider
      value={{
        favoriteDomains,
        addFavoriteDomains,
        deleteFavoriteDomains,
        reorderFavoriteDomains,
        communitySets,
        createCommunitySet,
        deleteCommunitySet,
        updateCommunitySet,
        reorderCommunitySets,
        getCommunity,
        refreshCommunity,
        isLoading
      }}
    >
      {children}
      <CommunitiesOnboardingDialog open={showOnboarding} onOpenChange={handleOnboardingClose} />
    </Nip05CommunitiesContext.Provider>
  )
}
