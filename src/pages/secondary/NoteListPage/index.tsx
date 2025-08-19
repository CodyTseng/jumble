import { Favicon } from '@/components/Favicon'
import NormalFeed from '@/components/NormalFeed'
import { Button } from '@/components/ui/button'
import { BIG_RELAY_URLS, SEARCHABLE_RELAY_URLS } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toProfileList } from '@/lib/link'
import { fetchPubkeysFromDomain, getWellKnownNip05Url } from '@/lib/nip05'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import client from '@/services/client.service'
import { TFeedSubRequest } from '@/types'
import { UserRound } from 'lucide-react'
import React, { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const NoteListPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { relayList, pubkey } = useNostr()
  const [title, setTitle] = useState<React.ReactNode>(null)
  const [controls, setControls] = useState<React.ReactNode>(null)
  const [data, setData] = useState<
    | {
        type: 'hashtag' | 'search' | 'externalContent'
        kinds?: number[]
      }
    | {
        type: 'domain'
        domain: string
        kinds?: number[]
      }
    | null
  >(null)
  const [subRequests, setSubRequests] = useState<TFeedSubRequest[]>([])

  useEffect(() => {
    const init = async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const kinds = searchParams
        .getAll('k')
        .map((k) => parseInt(k))
        .filter((k) => !isNaN(k))
      const hashtag = searchParams.get('t')
      if (hashtag) {
        setData({ type: 'hashtag' })
        setTitle(`# ${hashtag}`)
        setSubRequests([
          {
            filter: { '#t': [hashtag], ...(kinds.length > 0 ? { kinds } : {}) },
            urls: BIG_RELAY_URLS
          }
        ])
        return
      }
      const search = searchParams.get('s')
      if (search) {
        setData({ type: 'search' })
        setTitle(`${t('Search')}: ${search}`)
        setSubRequests([
          {
            filter: { search, ...(kinds.length > 0 ? { kinds } : {}) },
            urls: SEARCHABLE_RELAY_URLS
          }
        ])
        return
      }
      const externalContentId = searchParams.get('i')
      if (externalContentId) {
        setData({ type: 'externalContent' })
        setTitle(externalContentId)
        setSubRequests([
          {
            filter: { '#I': [externalContentId], ...(kinds.length > 0 ? { kinds } : {}) },
            urls: BIG_RELAY_URLS.concat(relayList?.write || [])
          }
        ])
        return
      }
      const domain = searchParams.get('d')
      if (domain) {
        setTitle(
          <div className="flex items-center gap-1">
            {domain}
            <Favicon domain={domain} className="w-5 h-5" />
          </div>
        )
        const pubkeys = await fetchPubkeysFromDomain(domain)
        setData({
          type: 'domain',
          domain
        })
        if (pubkeys.length) {
          setSubRequests(await client.generateSubRequestsForPubkeys(pubkeys, pubkey))
          setControls(
            <Button
              variant="ghost"
              className="h-10 [&_svg]:size-3"
              onClick={() => push(toProfileList({ domain }))}
            >
              {pubkeys.length.toLocaleString()} <UserRound />
            </Button>
          )
        } else {
          setSubRequests([])
        }
        return
      }
    }
    init()
  }, [])

  let content: React.ReactNode = null
  if (data?.type === 'domain' && subRequests.length === 0) {
    content = (
      <div className="text-center w-full py-10">
        <span className="text-muted-foreground">
          {t('No pubkeys found from {url}', { url: getWellKnownNip05Url(data.domain) })}
        </span>
      </div>
    )
  } else if (data) {
    content = <NormalFeed subRequests={subRequests} />
  }

  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={title}
      controls={controls}
      displayScrollToTopButton
    >
      {content}
    </SecondaryPageLayout>
  )
})
NoteListPage.displayName = 'NoteListPage'
export default NoteListPage
