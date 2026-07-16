import { ExtendedKind } from '@/constants'
import { BoundedMap } from '@/lib/bounded-map'
import { getPollResponseFromEvent } from '@/lib/event-metadata'
import DataLoader from 'dataloader'
import dayjs from 'dayjs'
import { Filter } from 'nostr-tools'
import client from './client.service'

export type TPollResults = {
  totalVotes: number
  results: Record<string, Set<string>>
  voters: Set<string>
  updatedAt: number
}

type TFetchPollResultsParams = {
  pollEventId: string
  relays: string[]
  validPollOptionIds: string[]
  isMultipleChoice: boolean
  endsAt?: number
}

class PollResultsService {
  static instance: PollResultsService
  private pollResultsMap = new BoundedMap<string, TPollResults>({ maxSize: 500 })
  private pollResultsSubscribers = new Map<string, Set<() => void>>()
  private loader = new DataLoader<TFetchPollResultsParams, TPollResults | undefined>(
    async (params) => {
      const pollMap = new Map<string, Omit<TFetchPollResultsParams, 'pollEventId'>>()

      params.forEach(({ pollEventId, relays, validPollOptionIds, isMultipleChoice, endsAt }) => {
        if (!pollMap.has(pollEventId)) {
          pollMap.set(pollEventId, { relays, validPollOptionIds, isMultipleChoice, endsAt })
        }
      })

      const pollResults = await Promise.allSettled(
        Array.from(pollMap).map(async ([pollEventId, pollParams]) => {
          const result = await this._fetchResults(
            pollEventId,
            pollParams.relays,
            pollParams.validPollOptionIds,
            pollParams.isMultipleChoice,
            pollParams.endsAt
          )
          return { pollEventId, result }
        })
      )

      const resultMap = new Map<string, TPollResults>()
      pollResults.forEach((promiseResult) => {
        if (promiseResult.status === 'fulfilled' && promiseResult.value.result) {
          resultMap.set(promiseResult.value.pollEventId, promiseResult.value.result)
        }
      })
      return params.map(({ pollEventId }) => resultMap.get(pollEventId))
    },
    { cache: false }
  )

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
    return this.loader.load({
      pollEventId,
      relays,
      validPollOptionIds,
      isMultipleChoice,
      endsAt
    })
  }

  private async _fetchResults(
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

    const responseEvents = await client.fetchEvents(relays, filter)

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
