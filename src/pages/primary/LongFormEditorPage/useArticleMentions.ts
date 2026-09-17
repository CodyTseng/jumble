import { extractMentions } from '@/lib/mentions'
import { TLongFormDraft } from '@/types/long-form-draft'
import { Dispatch, SetStateAction, useEffect, useMemo, useState } from 'react'

export async function resolveArticleMentions(
  draft: TLongFormDraft,
  currentPubkey: string | undefined
) {
  const [current, original] = await Promise.all([
    extractMentions(draft.content),
    draft.originalTags
      ? extractMentions(draft.originalContent ?? draft.content)
      : Promise.resolve({ pubkeys: [] as string[] })
  ])
  const tagged = draft.originalTags?.filter(([name]) => name === 'p').map((tag) => tag[1]) ?? []
  return {
    potentialMentions: Array.from(new Set(current.pubkeys)).filter(
      (pubkey) => pubkey !== currentPubkey
    ),
    originalMentions: original.pubkeys,
    taggedMentions: tagged
  }
}

export function selectArticleMentions(
  resolved: Awaited<ReturnType<typeof resolveArticleMentions>>,
  draft: TLongFormDraft
) {
  return resolved.potentialMentions.filter((pubkey) => {
    const selected = draft.mentionSelections?.[pubkey]
    if (selected !== undefined) return selected
    if (resolved.originalMentions.includes(pubkey)) return resolved.taggedMentions.includes(pubkey)
    return true
  })
}

export default function useArticleMentions(
  draft: TLongFormDraft,
  setDraft: Dispatch<SetStateAction<TLongFormDraft>>,
  currentPubkey: string | undefined
) {
  const input = useMemo(
    () => ({
      currentPubkey,
      identifier: draft.identifier,
      sourceEventId: draft.sourceEventId,
      content: draft.content,
      originalContent: draft.originalContent,
      originalTags: draft.originalTags
    }),
    [
      currentPubkey,
      draft.identifier,
      draft.sourceEventId,
      draft.content,
      draft.originalContent,
      draft.originalTags
    ]
  )
  const [resolved, setResolved] = useState<{
    input: typeof input
    result: Awaited<ReturnType<typeof resolveArticleMentions>>
  }>()

  useEffect(() => {
    let cancelled = false
    resolveArticleMentions(draft, currentPubkey).then((result) => {
      if (!cancelled) setResolved({ input, result })
    })
    return () => {
      cancelled = true
    }
  }, [input])

  const loading = resolved?.input !== input
  const potentialMentions = loading ? [] : resolved.result.potentialMentions
  const mentions = useMemo(
    () => (loading ? [] : selectArticleMentions(resolved.result, draft)),
    [loading, resolved, draft.mentionSelections]
  )

  return {
    loading,
    potentialMentions,
    mentions,
    setMentions: (selected: string[]) => {
      setDraft((current) => ({
        ...current,
        mentionSelections: {
          ...current.mentionSelections,
          ...Object.fromEntries(
            potentialMentions.map((pubkey) => [pubkey, selected.includes(pubkey)])
          )
        },
        updatedAt: Date.now()
      }))
    }
  }
}
