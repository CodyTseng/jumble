import { Favicon } from '@/components/Favicon'
import NoteList from '@/components/NoteList'
import { Button } from '@/components/ui/button'
import { BIG_RELAY_URLS, SEARCHABLE_RELAY_URLS } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { toProfileList } from '@/lib/link'
import { fetchPubkeysFromDomain, getWellKnownNip05Url } from '@/lib/nip05'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { UserRound } from 'lucide-react'
import { Filter } from 'nostr-tools'
import React, { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const NoteListPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { relayList } = useNostr()
  const [title, setTitle] = useState<React.ReactNode>(null)
  const [controls, setControls] = useState<React.ReactNode>(null)
  const [data, setData] = useState<
    | {
        type: 'hashtag' | 'search' | 'externalContent'
        filter: Filter
        urls: string[]
      }
    | {
        type: 'domain'
        filter: Filter
        domain: string
        urls?: string[]
      }
    | null
  >(null)

  useEffect(() => {
    const init = async () => {
      const searchParams = new URLSearchParams(window.location.search)
      const hashtag = searchParams.get('t')
      if (hashtag) {
        setData({
          type: 'hashtag',
          filter: { '#t': [hashtag] },
          urls: BIG_RELAY_URLS
        })
        setTitle(`# ${hashtag}`)
        return
      }
      const search = searchParams.get('s')
      if (search) {
        setData({
          type: 'search',
          filter: { search },
          urls: SEARCHABLE_RELAY_URLS
        })
        setTitle(`${t('Search')}: ${search}`)
        return
      }
      const externalContentId = searchParams.get('i')
      if (externalContentId) {
        setData({
          type: 'externalContent',
          filter: { '#I': [externalContentId] },
          urls: BIG_RELAY_URLS.concat(relayList?.write || [])
        })
        setTitle(externalContentId)
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
        console.log(domain, pubkeys)
        setData({
          type: 'domain',
          domain,
          filter: { authors: pubkeys }
        })
        if (pubkeys.length) {
          setControls(
            <Button
              variant="ghost"
              className="h-10 [&_svg]:size-3"
              onClick={() => push(toProfileList({ domain }))}
            >
              {pubkeys.length.toLocaleString()} <UserRound />
            </Button>
          )
        }
        return
      }
    }
    init()
  }, [])

  let content: React.ReactNode = null
  if (data?.type === 'domain' && data.filter?.authors?.length === 0) {
    content = (
      <div className="text-center w-full py-10">
        <span className="text-muted-foreground">
          {t('No pubkeys found from {url}', { url: getWellKnownNip05Url(data.domain) })}
        </span>
      </div>
    )
  } else if (data) {
    content = <NoteList filter={data.filter} relayUrls={data.urls} />
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
