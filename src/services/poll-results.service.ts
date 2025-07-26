import { ExtendedKind } from '@/constants'
import { getPollResponseFromEvent } from '@/lib/event-metadata'
import dayjs from 'dayjs'
import { Filter } from 'nostr-tools'
import client from './client.service'

export type TPollResults = {
  totalVotes: number
  results: Record<string, Set<string>>
  voters: Set<string>
  updatedAt: number
}

class PollResultsService {
  static instance: PollResultsService
  private pollResultsMap: Map<string, TPollResults> = new Map()
  private pollResultsSubscribers = new Map<string, Set<() => void>>()

  constructor() {
    if (!PollResultsService.instance) {
      PollResultsService.instance = this
    }
    return PollResultsService.instance
  }

  async fetchResults(
    pollEventId: string,
    relays: string[],
    validPollOptionIds: string[],
    isMultipleChoice: boolean,
    endsAt?: number
  ) {
    const filter: Filter = {
      kinds: [ExtendedKind.POLL_RESPONSE],
      '#e': [pollEventId],
      limit: 1000
    }

    if (endsAt) {
      filter.until = endsAt
    }

    let results = this.pollResultsMap.get(pollEventId)
    if (results) {
      if (endsAt && results.updatedAt >= endsAt) {
        return results
      }
      filter.since = results.updatedAt
    } else {
      results = {
        totalVotes: 0,
        results: validPollOptionIds.reduce(
          (acc, optionId) => {
            acc[optionId] = new Set<string>()
            return acc
          },
          {} as Record<string, Set<string>>
        ),
        voters: new Set<string>(),
        updatedAt: 0
      }
    }

    const responseEvents = await client.fetchEvents(relays, {
      kinds: [ExtendedKind.POLL_RESPONSE],
      '#e': [pollEventId],
      limit: 1000
    })

    results.updatedAt = dayjs().unix()

    const responses = responseEvents
      .map((evt) => getPollResponseFromEvent(evt, validPollOptionIds, isMultipleChoice))
      .filter((response): response is NonNullable<typeof response> => response !== null)

    responses
      .sort((a, b) => b.created_at - a.created_at)
      .forEach((response) => {
        if (results && results.voters.has(response.pubkey)) return
        results.voters.add(response.pubkey)

        results.totalVotes += response.selectedOptionIds.length
        response.selectedOptionIds.forEach((optionId) => {
          if (results.results[optionId]) {
            results.results[optionId].add(response.pubkey)
          }
        })
      })

    this.pollResultsMap.set(pollEventId, { ...results })
    if (responseEvents.length) {
      this.notifyPollResults(pollEventId)
    }
    return results
  }

  subscribePollResults(pollEventId: string, callback: () => void) {
    let set = this.pollResultsSubscribers.get(pollEventId)
    if (!set) {
      set = new Set()
      this.pollResultsSubscribers.set(pollEventId, set)
    }
    set.add(callback)
    return () => {
      set?.delete(callback)
      if (set?.size === 0) this.pollResultsSubscribers.delete(pollEventId)
    }
  }

  private notifyPollResults(pollEventId: string) {
    const set = this.pollResultsSubscribers.get(pollEventId)
    if (set) {
      set.forEach((cb) => cb())
    }
  }

  getPollResults(id: string): TPollResults | undefined {
    return this.pollResultsMap.get(id)
  }

  addPollResponse(pollEventId: string, pubkey: string, selectedOptionIds: string[]) {
    const results = this.pollResultsMap.get(pollEventId)
    if (!results) return

    if (results.voters.has(pubkey)) return

    results.voters.add(pubkey)
    results.totalVotes += selectedOptionIds.length
    selectedOptionIds.forEach((optionId) => {
      if (results.results[optionId]) {
        results.results[optionId].add(pubkey)
      }
    })

    this.pollResultsMap.set(pollEventId, { ...results })
    this.notifyPollResults(pollEventId)
  }
}

const instance = new PollResultsService()

export default instance
