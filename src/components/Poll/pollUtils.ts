import { ExtendedKind, POLL_TYPE } from '@/constants'
import { TPoll, TPollResponse, TPollType } from '@/types'
import { Event } from 'nostr-tools'

export function parsePollEvent(event: Event): TPoll | null {
  if (event.kind !== ExtendedKind.POLL) {
    return null
  }

  const options: TPoll['options'] = []
  const relayUrls: string[] = []
  let pollType: TPollType = POLL_TYPE.SINGLE_CHOICE
  let endsAt: number | undefined

  for (const [tagName, ...tagValues] of event.tags) {
    if (tagName === 'option' && tagValues.length >= 2) {
      const [optionId, label] = tagValues
      if (optionId && label) {
        options.push({ id: optionId, label })
      }
    } else if (tagName === 'relay' && tagValues[0]) {
      relayUrls.push(tagValues[0])
    } else if (tagName === 'polltype' && tagValues[0]) {
      if (tagValues[0] === 'multiplechoice') {
        pollType = 'multiplechoice'
      }
    } else if (tagName === 'endsAt' && tagValues[0]) {
      const timestamp = parseInt(tagValues[0])
      if (!isNaN(timestamp)) {
        endsAt = timestamp
      }
    }
  }

  if (options.length === 0) {
    return null
  }

  return {
    id: event.id,
    pubkey: event.pubkey,
    content: event.content,
    created_at: event.created_at,
    options,
    pollType,
    relayUrls,
    endsAt
  }
}

export function parsePollResponseEvent(event: Event): TPollResponse | null {
  if (event.kind !== ExtendedKind.POLL_RESPONSE) {
    return null
  }

  const selectedOptionIds: string[] = []
  let pollEventId: string | undefined

  for (const [tagName, ...tagValues] of event.tags) {
    if (tagName === 'e' && tagValues[0]) {
      pollEventId = tagValues[0]
    } else if (tagName === 'response' && tagValues[0]) {
      selectedOptionIds.push(tagValues[0])
    }
  }

  if (!pollEventId || selectedOptionIds.length === 0) {
    return null
  }

  return {
    id: event.id,
    pubkey: event.pubkey,
    pollEventId,
    selectedOptionIds,
    created_at: event.created_at
  }
}

export function calculatePollResults(
  poll: TPoll,
  responses: TPollResponse[]
): {
  totalVotes: number
  optionResults: Record<string, { count: number; percentage: number }>
} {
  const optionResults: Record<string, { count: number; percentage: number }> = {}

  // Initialize counts
  poll.options.forEach((option) => {
    optionResults[option.id] = { count: 0, percentage: 0 }
  })

  // Count votes per option
  responses.forEach((response) => {
    response.selectedOptionIds.forEach((optionId) => {
      if (optionResults[optionId]) {
        optionResults[optionId].count++
      }
    })
  })

  // Calculate total votes and percentages
  const totalVotes = Object.values(optionResults).reduce((sum, result) => sum + result.count, 0)

  if (totalVotes > 0) {
    Object.values(optionResults).forEach((result) => {
      result.percentage = (result.count / totalVotes) * 100
    })
  }

  return { totalVotes, optionResults }
}

export function getLatestResponsePerUser(responses: TPollResponse[]): TPollResponse[] {
  const userResponses = new Map<string, TPollResponse>()

  responses.forEach((response) => {
    const existing = userResponses.get(response.pubkey)
    if (!existing || response.created_at > existing.created_at) {
      userResponses.set(response.pubkey, response)
    }
  })

  return Array.from(userResponses.values())
}
