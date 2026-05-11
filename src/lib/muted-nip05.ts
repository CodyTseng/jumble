type TProfileWithNip05 = {
  pubkey: string
  nip05?: string | null
}

export function normalizeNip05Domain(value?: string | null) {
  if (!value) return null

  const normalized = value.trim().toLowerCase().replace(/^@+/, '').replace(/\/+$/, '')
  if (!normalized) return null

  const domain = normalized.includes('@') ? normalized.split('@').pop() : normalized
  return domain || null
}

export function normalizeMutedNip05Domains(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeNip05Domain(value))
        .filter((value): value is string => !!value)
    )
  )
}

export function isProfileMutedByNip05Domain(
  profile: TProfileWithNip05 | null | undefined,
  mutedNip05DomainSet: Set<string>,
  followingSet: Set<string>
) {
  if (!profile || mutedNip05DomainSet.size === 0) return false
  if (followingSet.has(profile.pubkey)) return false

  const domain = normalizeNip05Domain(profile.nip05)
  return !!domain && mutedNip05DomainSet.has(domain)
}

export async function getPubkeysMutedByNip05Domain(
  pubkeys: string[],
  mutedNip05DomainSet: Set<string>,
  followingSet: Set<string>,
  fetchProfile: (pubkey: string) => Promise<TProfileWithNip05 | null>
) {
  const mutedPubkeys = new Set<string>()
  if (mutedNip05DomainSet.size === 0) return mutedPubkeys

  const uniquePubkeys = Array.from(new Set(pubkeys)).filter((pubkey) => !followingSet.has(pubkey))
  const results = await Promise.allSettled(
    uniquePubkeys.map(async (pubkey) => ({
      pubkey,
      profile: await fetchProfile(pubkey)
    }))
  )

  results.forEach((result) => {
    if (result.status !== 'fulfilled') return
    const { pubkey, profile } = result.value
    if (isProfileMutedByNip05Domain(profile, mutedNip05DomainSet, followingSet)) {
      mutedPubkeys.add(pubkey)
    }
  })

  return mutedPubkeys
}
