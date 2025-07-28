import { Button } from '@/components/ui/button'
import { POLL_TYPE } from '@/constants'
import { useTranslatedEvent } from '@/hooks'
import { useFetchPollResults } from '@/hooks/useFetchPollResults'
import { createPollResponseDraftEvent } from '@/lib/draft-event'
import { getPollMetadataFromEvent } from '@/lib/event-metadata'
import { cn, isPartiallyInViewport } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import pollResultsService from '@/services/poll-results.service'
import dayjs from 'dayjs'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function Poll({ event, className }: { event: Event; className?: string }) {
  const { t } = useTranslation()
  const translatedEvent = useTranslatedEvent(event.id)
  const { pubkey, publish, startLogin } = useNostr()
  const [isVoting, setIsVoting] = useState(false)
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([])
  const pollResults = useFetchPollResults(event.id)
  const [isLoadingResults, setIsLoadingResults] = useState(false)
  const poll = useMemo(
    () => getPollMetadataFromEvent(translatedEvent ?? event),
    [event, translatedEvent]
  )
  const votedOptionIds = useMemo(() => {
    if (!pollResults || !pubkey) return []
    return Object.entries(pollResults.results)
      .filter(([, voters]) => voters.has(pubkey))
      .map(([optionId]) => optionId)
  }, [pollResults, pubkey])
  const validPollOptionIds = useMemo(() => poll?.options.map((option) => option.id) || [], [poll])
  const isExpired = useMemo(() => poll?.endsAt && dayjs().unix() > poll.endsAt, [poll])
  const isMultipleChoice = useMemo(() => poll?.pollType === POLL_TYPE.MULTIPLE_CHOICE, [poll])
  const canVote = useMemo(() => !isExpired && !votedOptionIds.length, [isExpired, votedOptionIds])
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (pollResults || isLoadingResults || !containerElement) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            if (isPartiallyInViewport(containerElement)) {
              fetchResults()
            }
          }, 200)
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(containerElement)

    return () => {
      observer.unobserve(containerElement)
    }
  }, [pollResults, isLoadingResults, containerElement])

  if (!poll) {
    return null
  }

  const fetchResults = async () => {
    setIsLoadingResults(true)
    try {
      const relays = await ensurePollRelays(event.pubkey, poll)
      return await pollResultsService.fetchResults(
        event.id,
        relays,
        validPollOptionIds,
        isMultipleChoice,
        poll.endsAt
      )
    } catch (error) {
      console.error('Failed to fetch poll results:', error)
      toast.error('Failed to fetch poll results: ' + (error as Error).message)
    } finally {
      setIsLoadingResults(false)
    }
  }

  const handleOptionClick = (optionId: string) => {
    if (isExpired) return

    if (isMultipleChoice) {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      )
    } else {
      setSelectedOptionIds((prev) => (prev.includes(optionId) ? [] : [optionId]))
    }
  }

  const handleVote = async () => {
    if (selectedOptionIds.length === 0) return
    if (!pubkey) {
      startLogin()
      return
    }

    setIsVoting(true)
    try {
      if (!pollResults) {
        const _pollResults = await fetchResults()
        if (_pollResults && _pollResults.voters.has(pubkey)) {
          return
        }
      }

      const additionalRelayUrls = await ensurePollRelays(event.pubkey, poll)

      const draftEvent = createPollResponseDraftEvent(event, selectedOptionIds)
      await publish(draftEvent, {
        additionalRelayUrls
      })

      setSelectedOptionIds([])
      pollResultsService.addPollResponse(event.id, pubkey, selectedOptionIds)
    } catch (error) {
      console.error('Failed to vote:', error)
      toast.error('Failed to vote: ' + (error as Error).message)
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <div className={className} ref={setContainerElement}>
      <div className="space-y-2">
        <div className="text-sm text-muted-foreground">
          <p>
            {poll.pollType === POLL_TYPE.MULTIPLE_CHOICE &&
              t('Multiple choice (select one or more)')}
          </p>
          <p>
            {!!poll.endsAt &&
              (isExpired
                ? t('Poll has ended')
                : t('Poll ends at {{time}}', {
                    time: new Date(poll.endsAt * 1000).toLocaleString()
                  }))}
          </p>
        </div>

        {/* Poll Options */}
        <div className="grid gap-2">
          {poll.options.map((option) => {
            const votes = pollResults?.results?.[option.id]?.size ?? 0
            const totalVotes = pollResults?.totalVotes ?? 0
            const percentage = !canVote && totalVotes > 0 ? (votes / totalVotes) * 100 : 0
            const isMax =
              pollResults && pollResults.totalVotes > 0 && !canVote
                ? Object.values(pollResults.results).every((res) => res.size <= votes)
                : false

            return (
              <button
                key={option.id}
                title={option.label}
                className={cn(
                  'relative w-full px-4 py-3 rounded-lg border transition-all flex items-center gap-2',
                  canVote ? 'cursor-pointer' : 'cursor-not-allowed',
                  canVote &&
                    (selectedOptionIds.includes(option.id)
                      ? 'border-primary bg-primary/20'
                      : 'hover:border-primary/40 hover:bg-primary/5')
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  handleOptionClick(option.id)
                }}
                disabled={!canVote}
              >
                {/* Content */}
                <div className="flex items-center gap-2 flex-1 w-0 z-10">
                  <div className={cn('line-clamp-2 text-left', isMax ? 'font-semibold' : '')}>
                    {option.label}
                  </div>
                  {votedOptionIds.includes(option.id) && (
                    <CheckCircle2 className="size-4 shrink-0" />
                  )}
                </div>
                {!canVote && (
                  <div
                    className={cn(
                      'text-muted-foreground shrink-0 z-10',
                      isMax ? 'font-semibold text-foreground' : ''
                    )}
                  >
                    {percentage.toFixed(1)}%
                  </div>
                )}

                {/* Progress Bar Background */}
                <div
                  className={cn(
                    'absolute inset-0 rounded-md transition-all duration-700 ease-out',
                    isMax ? 'bg-primary/60' : 'bg-muted/90'
                  )}
                  style={{ width: `${percentage}%` }}
                />
              </button>
            )
          })}
        </div>

        {/* Results Summary */}
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <div>{t('{{number}} votes', { number: pollResults?.totalVotes ?? 0 })}</div>

          {isLoadingResults && t('Loading...')}
          {!isLoadingResults && !canVote && (
            <div
              className="hover:underline cursor-pointer"
              onClick={(e) => {
                e.stopPropagation()
                fetchResults()
              }}
            >
              {!pollResults ? t('Load results') : t('Refresh results')}
            </div>
          )}
        </div>

        {/* Vote Button */}
        {canVote && !!selectedOptionIds.length && (
          <Button
            onClick={(e) => {
              e.stopPropagation()
              if (selectedOptionIds.length === 0) return
              handleVote()
            }}
            disabled={!selectedOptionIds.length || isVoting}
            className="w-full"
          >
            {isVoting && <Loader2 className="animate-spin" />}
            {t('Vote')}
          </Button>
        )}
      </div>
    </div>
  )
}

async function ensurePollRelays(creator: string, poll: { relayUrls: string[] }) {
  const relays = poll.relayUrls.slice(0, 4)
  if (!relays.length) {
    const relayList = await client.fetchRelayList(creator)
    relays.push(...relayList.read.slice(0, 4))
  }
  return relays
}
