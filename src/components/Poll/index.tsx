import { Button } from '@/components/ui/button'
import { useNostr } from '@/providers/NostrProvider'
import { TPollResults } from '@/types'
import { Event } from 'nostr-tools'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import client from '@/services/client.service'
import { ExtendedKind } from '@/constants'
import { parsePollEvent, parsePollResponseEvent, calculatePollResults, getLatestResponsePerUser } from './pollUtils'

interface PollProps {
  event: Event
  className?: string
}

export default function Poll({ event, className }: PollProps) {
  const { t } = useTranslation()
  const { signEvent } = useNostr()
  const [isVoting, setIsVoting] = useState(false)
  const [userVote, setUserVote] = useState<string[]>([])
  const [results, setResults] = useState<TPollResults | null>(null)
  const [isLoadingResults, setIsLoadingResults] = useState(false)

  const poll = useMemo(() => parsePollEvent(event), [event])

  useEffect(() => {
    if (!poll) return

    const fetchResults = async () => {
      setIsLoadingResults(true)
      try {
        const responseEvents = await client.fetchPollResponses(poll.id, poll.relayUrls)
        const responses = responseEvents
          .map(parsePollResponseEvent)
          .filter((response): response is NonNullable<typeof response> => response !== null)
        
        const latestResponses = getLatestResponsePerUser(responses)
        const { totalVotes, optionResults } = calculatePollResults(poll, latestResponses)
        
        setResults({
          poll,
          responses: latestResponses,
          totalVotes,
          optionResults
        })
      } catch (error) {
        console.error('Failed to fetch poll results:', error)
      } finally {
        setIsLoadingResults(false)
      }
    }

    fetchResults()
  }, [poll])

  if (!poll) {
    return null
  }

  const isExpired = poll.endsAt && Date.now() / 1000 > poll.endsAt
  const isMultipleChoice = poll.pollType === 'multiplechoice'

  const handleOptionClick = (optionId: string) => {
    if (isExpired) return

    if (isMultipleChoice) {
      setUserVote(prev => 
        prev.includes(optionId) 
          ? prev.filter(id => id !== optionId)
          : [...prev, optionId]
      )
    } else {
      setUserVote([optionId])
    }
  }

  const handleVote = async () => {
    if (userVote.length === 0) return

    setIsVoting(true)
    try {
      const tags = [
        ['e', poll.id],
        ...userVote.map(optionId => ['response', optionId])
      ]

      const draftEvent = {
        content: '',
        kind: ExtendedKind.POLL_RESPONSE,
        created_at: Math.floor(Date.now() / 1000),
        tags
      }

      const signedEvent = await signEvent(draftEvent)
      
      // Publish to poll relays
      await client.publishEvent(poll.relayUrls.length > 0 ? poll.relayUrls : client.getCurrentRelayUrls(), signedEvent)
      
      setUserVote([])
      
      // Refresh results
      const responseEvents = await client.fetchPollResponses(poll.id, poll.relayUrls)
      const responses = responseEvents
        .map(parsePollResponseEvent)
        .filter((response): response is NonNullable<typeof response> => response !== null)
      
      const latestResponses = getLatestResponsePerUser(responses)
      const { totalVotes, optionResults } = calculatePollResults(poll, latestResponses)
      
      setResults({
        poll,
        responses: latestResponses,
        totalVotes,
        optionResults
      })
    } catch (error) {
      console.error('Failed to vote:', error)
    } finally {
      setIsVoting(false)
    }
  }

  return (
    <div className={`bg-background border border-border rounded-xl p-4 ${className}`}>
      <div className="space-y-4">
        {/* Poll Question */}
        <div className="mb-4">
          <h3 className="text-base font-medium text-foreground leading-5">{poll.content}</h3>
          {poll.endsAt && (
            <p className="text-xs text-muted-foreground mt-1">
              {isExpired ? t('Poll ended') : t('Poll ends')}: {new Date(poll.endsAt * 1000).toLocaleString()}
            </p>
          )}
          {poll.pollType === 'multiplechoice' && (
            <p className="text-xs text-muted-foreground mt-1">{t('Multiple choice poll')}</p>
          )}
        </div>

        {/* Poll Options */}
        <div className="space-y-2">
          {poll.options.map((option) => {
            const isSelected = userVote.includes(option.id)
            const result = results?.optionResults[option.id]
            const percentage = result ? result.percentage : 0
            
            return (
              <div key={option.id} className="relative">
                {/* Option Button with Progress Bar */}
                <button
                  className={`w-full text-left p-4 rounded-xl border transition-all duration-200 relative overflow-hidden ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                      : 'border-border hover:border-blue-300 hover:bg-blue-50/50 dark:hover:bg-blue-950/10'
                  } ${isExpired || isVoting ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => handleOptionClick(option.id)}
                  disabled={isExpired || isVoting}
                >
                  {/* Progress Bar Background */}
                  {result && (
                    <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900/20 transition-all duration-500 ease-out" 
                         style={{ width: `${percentage}%` }} />
                  )}
                  
                  {/* Content */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{option.label}</span>
                    {result && (
                      <span className="text-xs text-muted-foreground">
                        {result.count} votes ({result.percentage.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </button>
              </div>
            )
          })}
        </div>

        {/* Vote Button */}
        {!isExpired && userVote.length > 0 && (
          <Button 
            onClick={handleVote} 
            disabled={isVoting}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-xl transition-colors"
          >
            {isVoting ? t('Voting...') : t('Vote')}
          </Button>
        )}

        {/* Loading State */}
        {isLoadingResults && (
          <div className="text-xs text-muted-foreground text-center py-2">
            {t('Loading results...')}
          </div>
        )}

        {/* Results Summary */}
        {results && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t border-border">
            {t('Total votes')}: {results.totalVotes.toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
} 