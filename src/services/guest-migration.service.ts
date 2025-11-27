import { BIG_RELAY_URLS } from '@/constants'
import { TDraftEvent } from '@/types'
import { Event } from 'nostr-tools'
import client from './client.service'

export type TMigrationProgress = {
  total: number
  migrated: number
  failed: number
}

class GuestMigrationService {
  static instance: GuestMigrationService

  public static getInstance(): GuestMigrationService {
    if (!GuestMigrationService.instance) {
      GuestMigrationService.instance = new GuestMigrationService()
    }
    return GuestMigrationService.instance
  }

  /**
   * Fetch all events from a guest account
   */
  async fetchGuestEvents(guestPubkey: string): Promise<Event[]> {
    console.log('[GuestMigration] Fetching events for guest:', guestPubkey)

    const events = await client.fetchEvents(BIG_RELAY_URLS, {
      authors: [guestPubkey],
      limit: 100 // Limit to most recent 100 events
    })

    console.log('[GuestMigration] Found', events.length, 'events')
    return events
  }

  /**
   * Migrate guest account events to a new account
   * This re-creates the events with the new account's signature
   */
  async migrateEvents(
    guestEvents: Event[],
    publishFn: (draft: TDraftEvent) => Promise<Event>,
    onProgress?: (progress: TMigrationProgress) => void
  ): Promise<{ migrated: Event[]; failed: Event[] }> {
    const migrated: Event[] = []
    const failed: Event[] = []

    for (let i = 0; i < guestEvents.length; i++) {
      const event = guestEvents[i]

      try {
        // Skip certain event kinds that shouldn't be migrated
        // (e.g., deletion events, ephemeral events)
        if (event.kind >= 20000 && event.kind < 30000) {
          console.log('[GuestMigration] Skipping ephemeral/replaceable event:', event.kind)
          continue
        }

        // Create a draft event with the same content and tags
        const draft: TDraftEvent = {
          kind: event.kind,
          content: event.content,
          tags: event.tags,
          created_at: Math.floor(Date.now() / 1000) // Use current timestamp
        }

        // Publish with the new account
        const newEvent = await publishFn(draft)
        migrated.push(newEvent)

        console.log('[GuestMigration] Migrated event:', event.id, '->', newEvent.id)
      } catch (error) {
        console.error('[GuestMigration] Failed to migrate event:', event.id, error)
        failed.push(event)
      }

      // Report progress
      if (onProgress) {
        onProgress({
          total: guestEvents.length,
          migrated: migrated.length,
          failed: failed.length
        })
      }
    }

    return { migrated, failed }
  }

  /**
   * Delete guest account events by publishing deletion events
   */
  async deleteGuestEvents(
    guestEvents: Event[],
    deleteFn: (event: Event) => Promise<void>
  ): Promise<void> {
    console.log('[GuestMigration] Deleting', guestEvents.length, 'guest events')

    for (const event of guestEvents) {
      try {
        await deleteFn(event)
      } catch (error) {
        console.error('[GuestMigration] Failed to delete event:', event.id, error)
      }
    }
  }
}

const instance = GuestMigrationService.getInstance()
export default instance
