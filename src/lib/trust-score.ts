export const TRUST_SCORE_SERVICE_URL = 'https://fayan.jumble.social'
export type JsonRequest = (
  url: string,
  options?: { method?: string; body?: string }
) => Promise<unknown>

export async function fetchTrustPercentiles(
  pubkeys: readonly string[],
  request: JsonRequest
): Promise<(number | null)[]> {
  try {
    const data = (await request(`${TRUST_SCORE_SERVICE_URL}/users`, {
      method: 'POST',
      body: JSON.stringify({ pubkeys })
    })) as Record<string, { percentile?: number }>
    return pubkeys.map((pubkey) => data[pubkey]?.percentile ?? 0)
  } catch {
    return pubkeys.map(() => null)
  }
}

export async function meetsTrustScore(
  pubkey: string,
  owner: string | null,
  minScore: number,
  trusted: ReadonlySet<string> | ReadonlyMap<string, unknown>,
  loadScore: (pubkey: string) => Promise<number | null>
): Promise<boolean> {
  if (minScore === 0 || pubkey === owner || trusted.has(pubkey)) return true
  const score = await loadScore(pubkey)
  return score === null || score >= minScore
}
