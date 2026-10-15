/* eslint-disable no-control-regex -- Upstream input validation intentionally rejects control characters. */
/** A bounded display/search projection of optional NIP-24 `t` tags. Never edits an event. */
export function normalizeTopic(value: string): string {
  if (value.length > 256) return ''
  const topic = value.trim().replace(/^#/, '').normalize('NFC').toLowerCase()
  if (
    !topic ||
    Array.from(topic).length > 64 ||
    /[\s#\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(topic)
  )
    return ''
  return topic
}

/** Call on a validated manifest. Missing or unusable topics never affect admission. */
export function manifestTopics(event: { tags: readonly (readonly string[])[] }): string[] {
  const topics = new Set<string>()
  for (const tag of event.tags) {
    if (tag[0] !== 't' || !tag[1]) continue
    const topic = normalizeTopic(tag[1])
    if (topic) topics.add(topic)
    if (topics.size === 32) break
  }
  return [...topics]
}

type SearchableNapplet = {
  title: string
  description: string
  creator: string
  topics: readonly string[]
  archetypes?: readonly string[]
  intents?: readonly { intent: string }[]
  domains?: readonly string[]
  optionalDomains?: readonly string[]
}

export type DiscoverySearch = {
  archetype?: string
  intent?: string
  requiredDomain?: string
  optionalDomain?: string
}

/** The same subject and text filters apply regardless of discovery source. */
export function matchesGallery(
  napplet: SearchableNapplet,
  search: { tag: string; q: string } & DiscoverySearch
) {
  const query = search.q.trim().toLowerCase()
  return (
    (!search.tag || napplet.topics.includes(search.tag)) &&
    (!search.archetype || !!napplet.archetypes?.includes(search.archetype)) &&
    (!search.intent || !!napplet.intents?.some((item) => item.intent === search.intent)) &&
    (!search.requiredDomain || !!napplet.domains?.includes(search.requiredDomain)) &&
    (!search.optionalDomain || !!napplet.optionalDomains?.includes(search.optionalDomain)) &&
    (!query ||
      `${napplet.title} ${napplet.description} ${napplet.creator} ${napplet.topics.map((t) => `#${t}`).join(' ')}`
        .toLowerCase()
        .includes(query))
  )
}

/** Counts describe this loaded collection, never all relay publications or granted capabilities. */
export function discoveryFacets(napplets: readonly SearchableNapplet[]) {
  const facets = (read: (entry: SearchableNapplet) => readonly string[]) => {
    const counts = new Map<string, number>()
    for (const entry of napplets)
      for (const value of new Set(read(entry))) counts.set(value, (counts.get(value) ?? 0) + 1)
    return [...counts]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value))
  }
  return {
    archetypes: facets((entry) => entry.archetypes ?? []),
    intents: facets((entry) => entry.intents?.map((item) => item.intent) ?? []),
    requiredDomains: facets((entry) => entry.domains ?? []),
    optionalDomains: facets((entry) => entry.optionalDomains ?? [])
  }
}
export type DiscoveryFacets = ReturnType<typeof discoveryFacets>

export function topicFacets(napplets: readonly SearchableNapplet[]) {
  const counts = new Map<string, number>()
  for (const napplet of napplets)
    for (const topic of new Set(napplet.topics)) counts.set(topic, (counts.get(topic) ?? 0) + 1)
  return [...counts]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || (a.topic < b.topic ? -1 : a.topic > b.topic ? 1 : 0))
}
