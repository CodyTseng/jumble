import { useFetchProfile } from '@/hooks/useFetchProfile'
import { toNote } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import client from '@/services/client.service'
import nipCdService from '@/services/nip-cd.service'
import type { Event } from 'nostr-tools'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function NipCdInvocation({
  command,
  executor,
  event,
  readOnly
}: {
  command: string
  executor: string
  event: Event
  readOnly: boolean
}) {
  const { profile } = useFetchProfile(executor)
  const { push } = useSecondaryPage()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  const name = profile?.original_username
  const label = (
    <>
      <bdi>/{command}</bdi>
      {name && (
        <>
          {'\u2009'}
          <bdi className="nip-cd-invocation-executor">@{name}</bdi>
        </>
      )}
    </>
  )

  if (readOnly) {
    return (
      <span className="nip-cd-invocation" dir="auto">
        {label}
      </span>
    )
  }

  return (
    <button
      type="button"
      className="nip-cd-invocation max-w-full cursor-pointer text-start focus-visible:outline-2 disabled:cursor-wait"
      dir="auto"
      disabled={loading}
      aria-busy={loading}
      onClick={async () => {
        if (pending.current) return
        const controller = new AbortController()
        pending.current = controller
        setLoading(true)
        try {
          const definition = await nipCdService.resolveCommandDefinition(executor, command, {
            kind: event.kind,
            author: event.pubkey,
            tags: event.tags
          })
          if (controller.signal.aborted) return
          if (!definition) {
            toast.error(t('Sorry! The note cannot be found 😔'))
            return
          }
          client.addEventToCache(definition)
          push(toNote(definition))
        } catch {
          if (!controller.signal.aborted) toast.error(t('Sorry! The note cannot be found 😔'))
        } finally {
          pending.current = null
          if (!controller.signal.aborted) setLoading(false)
        }
      }}
    >
      {label}
    </button>
  )
}
