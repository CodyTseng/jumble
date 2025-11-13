import { createProfileDraftEvent } from '@/lib/draft-event'
import { NostrEvent } from 'nostr-tools'

/**
 * SparkProfileSyncService - Syncs Spark Lightning address to Nostr profile
 *
 * Automatically updates the user's Nostr profile (kind 0) with their
 * Spark wallet Lightning address (lud16 field) when the wallet connects.
 */
class SparkProfileSyncService {
  private static instance: SparkProfileSyncService

  constructor() {
    if (!SparkProfileSyncService.instance) {
      SparkProfileSyncService.instance = this
    }
    return SparkProfileSyncService.instance
  }

  /**
   * Update the user's Nostr profile with their Spark Lightning address
   * @param lightningAddress - The Lightning address from Spark wallet (e.g., user@breez.lol)
   * @param currentProfileEvent - The user's current profile event (kind 0)
   * @param publish - Function to publish the updated profile event
   * @param updateProfileEvent - Function to update local profile cache
   */
  async syncLightningAddressToProfile(
    lightningAddress: string,
    currentProfileEvent: NostrEvent | null,
    publish: (event: any) => Promise<NostrEvent>,
    updateProfileEvent: (event: NostrEvent) => Promise<void>
  ): Promise<void> {
    try {
      // Safety check - don't publish if we don't have existing profile data
      if (!currentProfileEvent) {
        console.warn('[SparkProfileSync] No existing profile event - skipping sync to avoid data loss')
        return
      }

      const oldProfileContent = currentProfileEvent ? JSON.parse(currentProfileEvent.content) : {}

      // Check if Lightning address is already set to this value
      if (oldProfileContent.lud16 === lightningAddress) {
        console.log('[SparkProfileSync] Lightning address already up to date:', lightningAddress)
        return
      }

      console.log('[SparkProfileSync] Old profile content:', oldProfileContent)
      console.log('[SparkProfileSync] Updating profile with Lightning address:', lightningAddress)

      // Create updated profile content with new Lightning address
      const newProfileContent = {
        ...oldProfileContent,
        lud16: lightningAddress
      }

      console.log('[SparkProfileSync] New profile content:', newProfileContent)

      // Verify we're not losing data
      const oldKeys = Object.keys(oldProfileContent).length
      const newKeys = Object.keys(newProfileContent).length
      if (newKeys < oldKeys) {
        console.error('[SparkProfileSync] Data loss detected! Old keys:', oldKeys, 'New keys:', newKeys)
        throw new Error('Profile update would lose data - aborting')
      }

      // Create and sign the profile event
      const profileDraftEvent = createProfileDraftEvent(
        JSON.stringify(newProfileContent),
        currentProfileEvent?.tags || []
      )

      // Publish to relays
      const newProfileEvent = await publish(profileDraftEvent)

      // Update local cache
      await updateProfileEvent(newProfileEvent)

      console.log('[SparkProfileSync] Profile updated successfully with Lightning address')
    } catch (error) {
      console.error('[SparkProfileSync] Failed to sync Lightning address to profile:', error)
      throw error // Re-throw so caller can handle it
    }
  }
}

const instance = new SparkProfileSyncService()
export default instance
