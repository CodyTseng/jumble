import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { TNip05Community } from '@/types'
import { ChevronDown, Globe } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import UserAvatar from '../UserAvatar'
import { useFetchProfile } from '@/hooks'

export default function Nip05CommunityCard({
  community,
  select,
  onSelectChange,
  showMembers = false
}: {
  community: TNip05Community
  select: boolean
  onSelectChange: (select: boolean) => void
  showMembers?: boolean
}) {
  const { t } = useTranslation()
  const [expand, setExpand] = useState(false)

  return (
    <div
      className={`w-full border rounded-lg p-4 clickable ${select ? 'border-primary bg-primary/5' : ''}`}
      onClick={() => onSelectChange(!select)}
    >
      <div className="flex justify-between items-center">
        <div className="flex space-x-3 items-center cursor-pointer">
          <CommunityAvatar community={community} />
          <div className="flex flex-col">
            <div className="font-semibold select-none">
              {community.name || community.domain}
            </div>
            {community.name && (
              <div className="text-xs text-muted-foreground">{community.domain}</div>
            )}
            {community.description && (
              <div className="text-sm text-muted-foreground line-clamp-1">
                {community.description}
              </div>
            )}
          </div>
        </div>
        {showMembers && (
          <div className="flex gap-1">
            <MembersExpandToggle expand={expand} onExpandChange={setExpand}>
              {community.memberCount || community.members.length} {t('members')}
            </MembersExpandToggle>
          </div>
        )}
      </div>
      {expand && showMembers && <MembersList members={community.members.slice(0, 20)} />}
    </div>
  )
}

function CommunityAvatar({ community }: { community: TNip05Community }) {
  if (community.icon) {
    return (
      <Avatar className="w-10 h-10 shrink-0">
        <AvatarImage src={community.icon} alt={community.name || community.domain} />
        <AvatarFallback>
          <Globe className="size-5" />
        </AvatarFallback>
      </Avatar>
    )
  }

  return (
    <div className="flex justify-center items-center w-10 h-10 shrink-0 rounded-full bg-muted">
      <Globe className="size-5 text-muted-foreground" />
    </div>
  )
}

function MembersExpandToggle({
  children,
  expand,
  onExpandChange
}: {
  children: React.ReactNode
  expand: boolean
  onExpandChange: (expand: boolean) => void
}) {
  return (
    <div
      className="text-sm text-muted-foreground flex items-center gap-1 cursor-pointer hover:text-foreground"
      onClick={(e) => {
        e.stopPropagation()
        onExpandChange(!expand)
      }}
    >
      <div className="select-none">{children}</div>
      <ChevronDown
        size={16}
        className={`transition-transform duration-200 ${expand ? 'rotate-180' : ''}`}
      />
    </div>
  )
}

function MembersList({ members }: { members: string[] }) {
  const { t } = useTranslation()

  if (!members || members.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t space-y-2">
      <div className="text-xs text-muted-foreground font-medium">
        {t('Members')} {members.length > 20 && `(${t('showing first 20')})`}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {members.map((pubkey) => (
          <MemberItem key={pubkey} pubkey={pubkey} />
        ))}
      </div>
    </div>
  )
}

function MemberItem({ pubkey }: { pubkey: string }) {
  const { profile } = useFetchProfile(pubkey)
  const displayName = profile?.username || pubkey.slice(0, 8)

  return (
    <div className="flex items-center gap-2 min-w-0">
      <UserAvatar userId={pubkey} size="tiny" />
      <div className="text-sm text-muted-foreground truncate">
        {displayName}
      </div>
    </div>
  )
}
