import { TFeedSubRequest } from '@/types'
import { Filter } from 'nostr-tools'
import { decode } from 'nostr-tools/nip19'
import { normalizeUrl } from './url'

/**
 * Check if the input is a nak req command
 */
function isNakReqCommand(input: string): boolean {
  return input.startsWith('nak req ') || input.startsWith('req ')
}

/**
 * Parse a nak req command and return filter and relays
 *
 * Supported options:
 * --author, -a: only accept events from these authors (pubkey as hex)
 * --id, -i: only accept events with these ids (hex)
 * --kind, -k: only accept events with these kind numbers
 * --search: a nip50 search query
 * --tag, -t: takes a tag like -t e=<id>
 * -d: shortcut for --tag d=<value>
 * -e: shortcut for --tag e=<value>
 * -p: shortcut for --tag p=<value>
 *
 * Remaining arguments are treated as relay URLs
 */
export function parseNakReqCommand(input: string): TFeedSubRequest | null {
  const trimmed = input.trim()
  if (!isNakReqCommand(trimmed)) {
    return null
  }

  // Remove "nak req " or "req " prefix
  const argsString = trimmed.startsWith('nak') ? trimmed.slice(8).trim() : trimmed.slice(3).trim()
  if (!argsString) {
    return { filter: {}, urls: [] }
  }

  const args = parseArgs(argsString)
  const filter: Omit<Filter, 'since' | 'until'> = {}
  const relays: string[] = []

  let i = 0
  while (i < args.length) {
    const arg = args[i]

    // Handle options with values
    if (arg === '--author' || arg === '-a') {
      const value = args[++i]
      const hexId = value ? parseHexId(value) : null
      if (hexId) {
        if (!filter.authors) filter.authors = []
        if (!filter.authors.includes(hexId)) {
          filter.authors.push(hexId)
        }
      }
    } else if (arg === '--id' || arg === '-i') {
      const value = args[++i]
      const hexId = value ? parseHexId(value) : null
      if (hexId) {
        if (!filter.ids) filter.ids = []
        if (!filter.ids.includes(hexId)) {
          filter.ids.push(hexId)
        }
      }
    } else if (arg === '--kind' || arg === '-k') {
      const value = args[++i]
      if (value && /^\d+$/.test(value)) {
        const kind = parseInt(value, 10)
        if (!filter.kinds) filter.kinds = []
        if (!filter.kinds.includes(kind)) {
          filter.kinds.push(kind)
        }
      }
    } else if (arg === '--search') {
      const value = args[++i]
      if (value) {
        filter.search = value
      }
    } else if (arg === '--tag' || arg === '-t') {
      const value = args[++i]
      if (value) {
        const [tagName, tagValue] = parseTagValue(value)
        if (tagName && tagValue) {
          const tagKey = `#${tagName}`
          const filterRecord = filter as Record<string, string[]>
          if (!filterRecord[tagKey]) {
            filterRecord[tagKey] = []
          }
          if (!filterRecord[tagKey].includes(tagValue)) {
            filterRecord[tagKey].push(tagValue)
          }
        }
      }
    } else if (arg === '-d') {
      const value = args[++i]
      if (value) {
        if (!filter['#d']) filter['#d'] = []
        if (!filter['#d'].includes(value)) {
          filter['#d'].push(value)
        }
      }
    } else if (arg === '-e') {
      const value = args[++i]
      if (value && isValidHexId(value)) {
        if (!filter['#e']) filter['#e'] = []
        if (!filter['#e'].includes(value)) {
          filter['#e'].push(value)
        }
      }
    } else if (arg === '-p') {
      const value = args[++i]
      if (value && isValidHexId(value)) {
        if (!filter['#p']) filter['#p'] = []
        if (!filter['#p'].includes(value)) {
          filter['#p'].push(value)
        }
      }
    } else if (!arg.startsWith('-')) {
      // Treat as relay URL
      try {
        const url = normalizeUrl(arg)
        if (url.startsWith('wss://') || url.startsWith('ws://')) {
          if (!relays.includes(url)) {
            relays.push(url)
          }
        }
      } catch {
        // Ignore invalid URLs
      }
    }

    i++
  }

  return { filter, urls: relays }
}

/**
 * Parse command line arguments, handling quoted strings
 */
function parseArgs(input: string): string[] {
  const args: string[] = []
  let current = ''
  let inQuote: string | null = null

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (inQuote) {
      if (char === inQuote) {
        inQuote = null
      } else {
        current += char
      }
    } else if (char === '"' || char === "'") {
      inQuote = char
    } else if (char === ' ' || char === '\t') {
      if (current) {
        args.push(current)
        current = ''
      }
    } else {
      current += char
    }
  }

  if (current) {
    args.push(current)
  }

  return args
}

/**
 * Parse tag value in format "name=value"
 */
function parseTagValue(value: string): [string, string] | [null, null] {
  const idx = value.indexOf('=')
  if (idx === -1) {
    return [null, null]
  }
  return [value.slice(0, idx), value.slice(idx + 1)]
}

/**
 * Check if a string is valid hex of specified length
 */
function isValidHexId(value: string): boolean {
  return new RegExp(`^[0-9a-fA-F]{64}$`).test(value)
}

function parseHexId(value: string): string | null {
  if (isValidHexId(value)) {
    return value
  }
  if (['nevent', 'note', 'npub', 'nprofile'].every((prefix) => !value.startsWith(prefix))) {
    return null
  }

  try {
    const { type, data } = decode(value)
    if (type === 'nevent') {
      return data.id
    }
    if (type === 'note' || type === 'npub') {
      return data
    }
    if (type === 'nprofile') {
      return data.pubkey
    }
    return null
  } catch {
    return null
  }
}

/**
 * Format a filter for display
 */
export function formatFeedRequest(request: TFeedSubRequest): string {
  const parts: string[] = []

  if (request.filter.kinds?.length) {
    parts.push(`kinds: ${request.filter.kinds.join(', ')}`)
  }
  if (request.filter.authors?.length) {
    parts.push(`authors: ${request.filter.authors.length}`)
  }
  if (request.filter.ids?.length) {
    parts.push(`ids: ${request.filter.ids.length}`)
  }
  if (request.filter.search) {
    parts.push(`search: "${request.filter.search}"`)
  }

  // Check for tag filters
  for (const key of Object.keys(request.filter)) {
    if (key.startsWith('#')) {
      const values = request.filter[key as keyof typeof request.filter] as string[]
      if (values?.length) {
        parts.push(`${key}: ${values.length}`)
      }
    }
  }

  if (request.urls.length) {
    parts.push(`relays: ${request.urls.length}`)
  }

  return parts.join(' | ') || 'No filters'
}
