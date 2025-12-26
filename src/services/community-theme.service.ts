import { TPrimaryColor } from '@/constants'
import { TThemeSetting } from '@/types'

export type TCommunityTheme = {
  themeSetting: TThemeSetting
  primaryColor: TPrimaryColor
}

class CommunityThemeService {
  private themeCache: Map<string, TCommunityTheme> = new Map()
  private fetchPromises: Map<string, Promise<TCommunityTheme | null>> = new Map()

  /**
   * Fetch theme configuration from a community domain
   * @param domain - The community domain (e.g., "nostrhood.social")
   * @returns Theme configuration or null if not available
   */
  async fetchCommunityTheme(domain: string): Promise<TCommunityTheme | null> {
    // Clean the domain
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')

    // Check cache first
    if (this.themeCache.has(cleanDomain)) {
      return this.themeCache.get(cleanDomain)!
    }

    // Check if we're already fetching this domain
    if (this.fetchPromises.has(cleanDomain)) {
      return this.fetchPromises.get(cleanDomain)!
    }

    // Create new fetch promise
    const fetchPromise = this.doFetchTheme(cleanDomain)
    this.fetchPromises.set(cleanDomain, fetchPromise)

    try {
      const result = await fetchPromise
      return result
    } finally {
      this.fetchPromises.delete(cleanDomain)
    }
  }

  private async doFetchTheme(domain: string): Promise<TCommunityTheme | null> {
    try {
      const themeUrl = `https://${domain}/theme.json`
      const response = await fetch(themeUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-cache'
      })

      if (!response.ok) {
        console.log(`[CommunityTheme] No theme.json found for ${domain}`)
        return null
      }

      const themeData = await response.json()

      // Validate the theme data
      if (!this.isValidTheme(themeData)) {
        console.warn(`[CommunityTheme] Invalid theme.json format for ${domain}`)
        return null
      }

      const theme: TCommunityTheme = {
        themeSetting: themeData.themeSetting,
        primaryColor: themeData.primaryColor
      }

      // Cache the theme
      this.themeCache.set(domain, theme)
      console.log(`[CommunityTheme] Loaded theme for ${domain}:`, theme)

      return theme
    } catch (error) {
      console.error(`[CommunityTheme] Error fetching theme for ${domain}:`, error)
      return null
    }
  }

  private isValidTheme(data: any): boolean {
    if (!data || typeof data !== 'object') return false

    const validThemeSettings = ['light', 'dark', 'system', 'pure-black']
    const hasValidThemeSetting = validThemeSettings.includes(data.themeSetting)

    // primaryColor should be a string (we'll validate against PRIMARY_COLORS in the provider)
    const hasValidPrimaryColor = typeof data.primaryColor === 'string'

    return hasValidThemeSetting && hasValidPrimaryColor
  }

  /**
   * Clear cached theme for a domain (useful for refreshing)
   */
  clearCache(domain: string): void {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '')
    this.themeCache.delete(cleanDomain)
  }

  /**
   * Clear all cached themes
   */
  clearAllCache(): void {
    this.themeCache.clear()
  }
}

const communityThemeService = new CommunityThemeService()
export default communityThemeService
