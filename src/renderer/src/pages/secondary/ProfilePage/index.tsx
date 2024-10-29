import Nip05 from '@renderer/components/Nip05'
import NoteList from '@renderer/components/NoteList'
import ProfileAbout from '@renderer/components/ProfileAbout'
import { Separator } from '@renderer/components/ui/separator'
import UserAvatar from '@renderer/components/UserAvatar'
import { useFetchProfile } from '@renderer/hooks'
import SecondaryPageLayout from '@renderer/layouts/SecondaryPageLayout'
import { formatNpub, generateImageByPubkey } from '@renderer/lib/pubkey'
import { Copy } from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ProfilePage({ pubkey }: { pubkey?: string }) {
  const { banner, username, nip05, about, npub } = useFetchProfile(pubkey)
  const [copied, setCopied] = useState(false)

  if (!pubkey || !npub) return null

  const copyNpub = () => {
    if (!npub) return
    navigator.clipboard.writeText(npub)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <SecondaryPageLayout titlebarContent={username}>
      <div className="relative bg-cover bg-center w-full aspect-[21/9] rounded-lg mb-12">
        <ProfileBanner
          banner={banner}
          pubkey={pubkey}
          className="w-full h-full object-cover rounded-lg"
        />
        <UserAvatar
          userId={pubkey}
          size="large"
          className="absolute bottom-0 left-4 translate-y-1/2 border-4 border-background"
        />
      </div>
      <div className="px-4 space-y-1">
        <div className="text-xl font-semibold">{username}</div>
        {nip05 && <Nip05 nip05={nip05} pubkey={pubkey} />}
        <div
          className="flex gap-2 text-sm text-muted-foreground items-center bg-muted w-fit px-2 rounded-full hover:text-foreground cursor-pointer"
          onClick={() => copyNpub()}
        >
          {copied ? (
            <div>Copied!</div>
          ) : (
            <>
              <div>{formatNpub(npub, 24)}</div>
              <Copy size={14} />
            </>
          )}
        </div>
        <div className="text-sm text-wrap break-words whitespace-pre-wrap">
          <ProfileAbout about={about} />
        </div>
      </div>
      <Separator className="my-2" />
      <NoteList key={pubkey} filter={{ authors: [pubkey] }} />
    </SecondaryPageLayout>
  )
}

function ProfileBanner({
  banner,
  pubkey,
  className
}: {
  banner?: string
  pubkey: string
  className?: string
}) {
  const defaultBanner = generateImageByPubkey(pubkey)
  const [bannerUrl, setBannerUrl] = useState(banner || defaultBanner)

  useEffect(() => {
    if (banner) {
      setBannerUrl(banner)
    } else {
      setBannerUrl(defaultBanner)
    }
  }, [pubkey, banner])

  return (
    <img
      src={bannerUrl}
      alt="Banner"
      className={className}
      onError={() => setBannerUrl(defaultBanner)}
    />
  )
}
