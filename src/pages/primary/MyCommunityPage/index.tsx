import PrimaryPageLayout from '@/layouts/PrimaryPageLayout'
import { TPageRef } from '@/types'
import { Users, PlusCircle } from 'lucide-react'
import { forwardRef, useImperativeHandle, useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFeed } from '@/providers/FeedProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Skeleton } from '@/components/ui/skeleton'
import { SimpleUserAvatar } from '@/components/UserAvatar'
import { useFetchProfile } from '@/hooks'
import { toProfile } from '@/lib/link'
import { useSecondaryPage } from '@/PageManager'
import ProfileAbout from '@/components/ProfileAbout'
import Nip05 from '@/components/Nip05'
import nip05CommunityService from '@/services/nip05-community.service'
import { Button } from '@/components/ui/button'

const MyCommunityPage = forwardRef((_, ref) => {
  const layoutRef = useRef<TPageRef>(null)
  useImperativeHandle(ref, () => layoutRef.current)

  return (
    <PrimaryPageLayout
      pageName="my-community"
      ref={layoutRef}
      titlebar={<MyCommunityPageTitlebar />}
      displayScrollToTopButton
    >
      <MyCommunityContent />
    </PrimaryPageLayout>
  )
})
MyCommunityPage.displayName = 'MyCommunityPage'
export default MyCommunityPage

function MyCommunityPageTitlebar() {
  const { t } = useTranslation()
  const { push } = useSecondaryPage()
  const { checkLogin, pubkey } = useNostr()
  const { feedInfo } = useFeed()
  const [isAdmin, setIsAdmin] = useState(false)

  const domain = feedInfo.feedType === 'nip05-domain' ? feedInfo.id : null

  useEffect(() => {
    const checkAdmin = async () => {
      if (!domain || !pubkey) {
        setIsAdmin(false)
        return
      }

      try {
        // Get members from the domain (uses cache if available)
        const members = await nip05CommunityService.getDomainMembers(domain)

        // User is admin if they're the first member
        setIsAdmin(members.length > 0 && members[0] === pubkey)
      } catch (error) {
        console.error('[MyCommunityPageTitlebar] Error checking admin status:', error)
        setIsAdmin(false)
      }
    }

    checkAdmin()
  }, [domain, pubkey])

  return (
    <div className="flex gap-2 items-center justify-between h-full pl-3 pr-3 w-full">
      <div className="flex gap-2 items-center">
        <Users />
        <div className="text-lg font-semibold">{t('My Community')}</div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => checkLogin(() => push('/communities/create'))}
        className="gap-2 text-base font-semibold"
      >
        {isAdmin ? (
          <>
            <PlusCircle className="w-4 h-4" />
            {t('Manage')}
          </>
        ) : (
          <>
            <PlusCircle className="w-4 h-4" />
            {t('Create')}
          </>
        )}
      </Button>
    </div>
  )
}

function MyCommunityContent() {
  const { t } = useTranslation()
  const { profile } = useNostr()
  const { feedInfo } = useFeed()
  const [members, setMembers] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Get user's NIP-05 domain
  const domain = feedInfo.feedType === 'nip05-domain' ? feedInfo.id : null

  useEffect(() => {
    const fetchMembers = async () => {
      if (!domain) {
        console.log('[MyCommunityPage] No domain found')
        setIsLoading(false)
        return
      }

      try {
        console.log('[MyCommunityPage] Fetching members for domain:', domain)
        setIsLoading(true)

        // Directly fetch members from the domain
        const membersList = await nip05CommunityService.getDomainMembers(domain)
        console.log('[MyCommunityPage] Got members:', membersList.length, membersList)

        setMembers(membersList)
      } catch (error) {
        console.error('[MyCommunityPage] Error fetching members:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMembers()
  }, [domain])

  if (!profile?.nip05 || !domain) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Users className="mx-auto mb-4 w-12 h-12 opacity-50" />
        <p className="text-lg mb-2">{t('No Community')}</p>
        <p className="text-sm">
          {t('Add a NIP-05 identifier to your profile to join a community')}
        </p>
      </div>
    )
  }

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
          <div className="flex-1">
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xl font-bold mb-1 hover:underline hover:text-primary transition-colors inline-block"
            >
              {domain}
            </a>
            <p className="text-sm text-muted-foreground">
              {members.length} {t('members')}
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
