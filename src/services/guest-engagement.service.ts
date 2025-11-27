import { StorageKey } from '@/constants'

const ENGAGEMENT_THRESHOLD = 7

export type TEngagementAction =
  | 'like' // kind 7 reaction
  | 'repost' // kind 6 repost
  | 'comment' // kind 1 reply
  | 'bookmark' // bookmark action
  | 'follow' // add to follow list
  | 'post' // kind 1 new post
  | 'profile_update' // kind 0 profile update

export type TGuestEngagement = {
  count: number
  actions: Array<{
    type: TEngagementAction
    timestamp: number
  }>
  thresholdReached: boolean
  modalDismissed: boolean
}

class GuestEngagementService {
  static instance: GuestEngagementService

  public static getInstance(): GuestEngagementService {
    if (!GuestEngagementService.instance) {
      GuestEngagementService.instance = new GuestEngagementService()
    }
    return GuestEngagementService.instance
  }

  private engagement: TGuestEngagement
  private listeners: Array<(engagement: TGuestEngagement) => void> = []

  constructor() {
    this.engagement = this.loadFromStorage()
  }

  private loadFromStorage(): TGuestEngagement {
    const stored = window.localStorage.getItem(StorageKey.GUEST_ENGAGEMENT)
    if (stored) {
      return JSON.parse(stored)
    }
    return {
      count: 0,
      actions: [],
      thresholdReached: false,
      modalDismissed: false
    }
  }

  private saveToStorage(): void {
    window.localStorage.setItem(StorageKey.GUEST_ENGAGEMENT, JSON.stringify(this.engagement))
    this.notifyListeners()
  }

  /**
   * Track a new engagement action
   */
  trackAction(type: TEngagementAction): void {
    // Don't track if threshold already reached and modal was shown
    if (this.engagement.thresholdReached && this.engagement.modalDismissed) {
      return
    }

    this.engagement.actions.push({
      type,
      timestamp: Date.now()
    })
    this.engagement.count = this.engagement.actions.length

    // Check if threshold reached
    if (this.engagement.count >= ENGAGEMENT_THRESHOLD && !this.engagement.thresholdReached) {
      this.engagement.thresholdReached = true
    }

    this.saveToStorage()

    console.log(
      `[GuestEngagement] Tracked ${type} action. Count: ${this.engagement.count}/${ENGAGEMENT_THRESHOLD}`
    )
  }

  /**
   * Check if threshold has been reached
   */
  hasReachedThreshold(): boolean {
    return this.engagement.thresholdReached
  }

  /**
   * Check if modal has been dismissed
   */
  hasModalBeenDismissed(): boolean {
    return this.engagement.modalDismissed
  }

  /**
   * Mark the conversion modal as dismissed
   */
  markModalDismissed(): void {
    this.engagement.modalDismissed = true
    this.saveToStorage()
  }

  /**
   * Get current engagement data
   */
  getEngagement(): TGuestEngagement {
    return { ...this.engagement }
  }

  /**
   * Get engagement count
   */
  getCount(): number {
    return this.engagement.count
  }

  /**
   * Get threshold value
   */
  getThreshold(): number {
    return ENGAGEMENT_THRESHOLD
  }

  /**
   * Reset engagement (e.g., after account creation)
   */
  reset(): void {
    this.engagement = {
      count: 0,
      actions: [],
      thresholdReached: false,
      modalDismissed: false
    }
    window.localStorage.removeItem(StorageKey.GUEST_ENGAGEMENT)
    this.notifyListeners()
  }

  /**
   * Upgrade guest account to permanent
   * This removes the guest flag and resets engagement tracking
   */
  upgradeGuestAccount(): void {
    console.log('[GuestEngagement] Upgrading guest account to permanent')
    this.reset()
  }

  /**
   * Subscribe to engagement changes
   */
  subscribe(listener: (engagement: TGuestEngagement) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener({ ...this.engagement }))
  }

  /**
   * Check if should show conversion modal
   */
  shouldShowConversionModal(): boolean {
    return this.engagement.thresholdReached && !this.engagement.modalDismissed
  }
}

const instance = GuestEngagementService.getInstance()
export default instance
