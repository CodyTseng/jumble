import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TNip05Community } from '@/types'
import { Globe, Heart, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'
import NotFound from '../NotFound'
import Tabs from '../Tabs'
import CommunityFeed from './CommunityFeed'
import CommunityMembers from './CommunityMembers'

type TCommunityTabs = 'feed' | 'members'

export default function Nip05Community({ domain }: { domain?: string }) {
  const { t } = useTranslation()
  const { getCommunity, favoriteDomains, addFavoriteDomains, deleteFavoriteDomains } =
    useNip05Communities()
  const [community, setCommunity] = useState<TNip05Community | null | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<TCommunityTabs>('feed')
  const [topContainerHeight, setTopContainerHeight] = useState(0)
  const [topContainer, setTopContainer] = useState<HTMLDivElement | null>(null)

  const isFavorite = domain ? favoriteDomains.includes(domain) : false

  const topContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      setTopContainer(node)
    }
  }, [])

  useEffect(() => {
    if (!domain) {
      setIsLoading(false)
      setCommunity(null)
      return
    }

    setIsLoading(true)
    getCommunity(domain)
      .then((data) => {
        setCommunity(data || null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [domain, getCommunity])

  useEffect(() => {
    if (!topContainer) return

    const checkHeight = () => {
      setTopContainerHeight(topContainer.scrollHeight)
    }

    checkHeight()

    const observer = new ResizeObserver(() => {
      checkHeight()
    })

    observer.observe(topContainer)

    return () => {
      observer.disconnect()
    }
  }, [topContainer])

  if (isLoading) {
    return (
      <div>
        <div className="px-4 py-6">
          <div className="flex items-start gap-4">
            <Skeleton className="w-20 h-20 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-64" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!community || !domain) {
    return <NotFound />
  }

  const { name, description, icon, memberCount, members } = community

  return (
    <>
      <div ref={topContainerRef}>
        <div className="px-4 py-6">
          <div className="flex items-start gap-4">
            {icon ? (
              <Avatar className="w-20 h-20 shrink-0">
                <AvatarImage src={icon} alt={name || domain} />
                <AvatarFallback>
                  <Globe className="size-10" />
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="flex justify-center items-center w-20 h-20 shrink-0 rounded-full bg-muted">
                <Globe className="size-10 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <h1 className="text-2xl font-semibold truncate select-text">
                    {name || domain}
                  </h1>
                  {name && <div className="text-sm text-muted-foreground truncate">{domain}</div>}
                </div>
                <Button
                  variant={isFavorite ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (isFavorite) {
                      deleteFavoriteDomains([domain])
                    } else {
                      addFavoriteDomains([domain])
                    }
                  }}
                  className="shrink-0"
                >
                  <Heart className={`size-4 mr-1 ${isFavorite ? 'fill-current' : ''}`} />
                  {isFavorite ? t('Favorited') : t('Favorite')}
                </Button>
              </div>
              {description && (
                <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap break-words select-text">
                  {description}
                </p>
              )}
              <div className="flex gap-4 items-center mt-3 text-sm">
                <div className="flex gap-1 items-center text-muted-foreground">
                  <Users className="size-4" />
                  <span className="font-medium text-foreground">
                    {memberCount || members.length}
                  </span>
                  <span>{t('members')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Tabs
          value={tab}
          tabs={[
            { value: 'feed', label: t('Feed') },
            { value: 'members', label: t('Members') }
          ]}
          onTabChange={(tab) => setTab(tab as TCommunityTabs)}
        />
      </div>
      {tab === 'feed' ? (
        <CommunityFeed domain={domain} topSpace={topContainerHeight} />
      ) : (
        <CommunityMembers members={members} domain={domain} />
      )}
    </>
  )
}
