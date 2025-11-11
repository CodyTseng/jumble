import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { TNip05Community } from '@/types'
import { Globe, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNip05Communities } from '@/providers/Nip05CommunitiesProvider'
import NotFound from '../NotFound'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import { SimpleUserAvatar } from '../UserAvatar'
import ProfileAbout from '../ProfileAbout'
import Nip05 from '../Nip05'

export default function Nip05Community({ domain }: { domain?: string }) {
  const { t } = useTranslation()
  const { getCommunity } = useNip05Communities()
  const [community, setCommunity] = useState<TNip05Community | null | undefined>(undefined)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    console.log('[Nip05Community] Received domain:', domain)
    if (!domain) {
      console.log('[Nip05Community] No domain provided')
      setIsLoading(false)
      setCommunity(null)
      return
    }

    // Decode the domain in case it was URL encoded
    const decodedDomain = decodeURIComponent(domain)
    console.log('[Nip05Community] Decoded domain:', decodedDomain)

    setIsLoading(true)
    getCommunity(decodedDomain)
      .then((data) => {
        console.log('[Nip05Community] Got community data:', data)
        console.log('[Nip05Community] Community members:', data?.members?.length)
        console.log('[Nip05Community] Community memberCount:', data?.memberCount)
        setCommunity(data || null)
      })
      .catch((error) => {
        console.error('[Nip05Community] Error getting community:', error)
        setCommunity(null)
      })
      .finally(() => {
        console.log('[Nip05Community] Loading finished, community set to:', community)
        setIsLoading(false)
      })
  }, [domain, getCommunity])

  if (isLoading) {
    return (
      <div className="p-4 space-y-6">
        <Skeleton className="h-48 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!community || !domain) {
    return <NotFound />
  }

  const { name, icon, memberCount, members } = community

  if (!members || members.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Users className="mx-auto mb-4 w-12 h-12 opacity-50" />
        <p className="text-lg mb-2">{t('Community Not Found')}</p>
        <p className="text-sm">
          {t('Could not load community data for')} {domain}
        </p>
      </div>
    )
  }

  // First member is the admin
  const adminPubkey = members[0]
  const otherMembers = members.slice(1)

  return (
    <div className="pb-4">
      {/* Community Header */}
      <div className="p-6 border-b">
        <div className="flex items-start gap-4">
          <CommunityAvatar domain={domain} icon={icon} name={name} />
          <div className="flex-1">
            {name ? (
              <>
                <h1 className="text-2xl font-bold mb-1">{name}</h1>
                <a
                  href={`https://${domain}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground mb-1 hover:underline hover:text-primary transition-colors inline-block"
                >
                  {domain}
                </a>
              </>
            ) : (
              <a
                href={`https://${domain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-2xl font-bold mb-1 hover:underline hover:text-primary transition-colors inline-block"
              >
                {domain}
              </a>
            )}
            <p className="text-sm text-muted-foreground">
              {memberCount || members.length} {t('members')}
            </p>
          </div>
        </div>
      </div>

      {/* Admin Profile */}
      {adminPubkey && (
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold mb-4">{t('Community Admin')}</h2>
          <AdminProfile pubkey={adminPubkey} domain={domain} />
        </div>
      )}

      {/* Other Members */}
      {otherMembers.length > 0 && (
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            {t('Members')} ({otherMembers.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {otherMembers.map((pubkey) => (
              <MemberCard key={pubkey} pubkey={pubkey} domain={domain} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CommunityAvatar({
  domain,
  icon,
  name
}: {
  domain: string
  icon?: string
  name?: string
}) {
  const [faviconError, setFaviconError] = useState(false)
  const [googleFaviconError, setGoogleFaviconError] = useState(false)

  // Try multiple favicon sources in order of preference
  const faviconUrl = icon || `https://${domain}/favicon.ico`
  const googleFaviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`

  // If all favicon sources fail, show globe
  if (faviconError && googleFaviconError) {
    return (
      <div className="flex justify-center items-center w-20 h-20 shrink-0 rounded-full bg-muted">
        <Globe className="size-10 text-muted-foreground" />
      </div>
    )
  }

  return (
    <Avatar className="w-20 h-20 shrink-0">
      {!faviconError ? (
        <AvatarImage
          src={faviconUrl}
          alt={name || domain}
          onError={() => setFaviconError(true)}
        />
      ) : !googleFaviconError ? (
        <AvatarImage
          src={googleFaviconUrl}
          alt={name || domain}
          onError={() => setGoogleFaviconError(true)}
        />
      ) : null}
      <AvatarFallback>
        <Globe className="size-10" />
      </AvatarFallback>
    </Avatar>
  )
}

function AdminProfile({ pubkey, domain }: { pubkey: string; domain: string }) {
  const { profile, isFetching } = useFetchProfile(pubkey)
  const { push } = useSecondaryPage()

  if (isFetching) {
    return (
      <div className="flex items-start gap-4 p-6 border rounded-lg">
        <Skeleton className="w-24 h-24 rounded-full" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    )
  }

  const displayName = profile?.username || pubkey.slice(0, 8)
  const nip05 = profile?.nip05
  const lud16 = profile?.lud16
  const about = profile?.about

  return (
    <div
      className="flex items-start gap-4 p-6 border rounded-lg clickable hover:bg-muted/50 transition-colors"
      onClick={() => push(toProfile(pubkey))}
    >
      <SimpleUserAvatar userId={pubkey} className="w-24 h-24" />
      <div className="flex-1 min-w-0">
        <div className="text-xl font-bold mb-1">{displayName}</div>
        {nip05 && (
          <div className="mb-2">
            <Nip05 pubkey={pubkey} />
          </div>
        )}
        {lud16 && (
          <div className="text-sm text-muted-foreground mb-2 truncate">
            ⚡ {lud16}
          </div>
        )}
        {about && (
          <ProfileAbout
            about={about}
            className="text-sm text-muted-foreground line-clamp-3 mt-2"
          />
        )}
      </div>
    </div>
  )
}

function MemberCard({ pubkey, domain }: { pubkey: string; domain: string }) {
  const { push } = useSecondaryPage()
  const { profile, isFetching } = useFetchProfile(pubkey)

  if (isFetching) {
    return (
      <div className="flex items-center gap-3 p-3 border rounded-lg">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    )
  }

  const displayName = profile?.username || pubkey.slice(0, 8)
  const nip05 = profile?.nip05

  return (
    <div
      className="flex items-center gap-3 p-3 border rounded-lg clickable hover:bg-muted/50 transition-colors"
      onClick={() => push(toProfile(pubkey))}
    >
      <SimpleUserAvatar userId={pubkey} className="w-12 h-12" />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{displayName}</div>
        {nip05 && (
          <div className="text-xs text-muted-foreground truncate">
            {nip05.endsWith(`@${domain}`) ? nip05.replace(`@${domain}`, '') : nip05}@{domain}
          </div>
        )}
        {!nip05 && (
          <div className="text-xs text-muted-foreground truncate">{pubkey.slice(0, 16)}...</div>
        )}
      </div>
    </div>
  )
}
