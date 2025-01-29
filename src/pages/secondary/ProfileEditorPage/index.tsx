import Uploader from '@/components/PostEditor/Uploader'
import ProfileBanner from '@/components/ProfileBanner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EMAIL_REGEX } from '@/constants'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { createProfileDraftEvent } from '@/lib/draft-event'
import { generateImageByPubkey } from '@/lib/pubkey'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { Loader, Upload } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const ProfileEditorPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pop } = useSecondaryPage()
  const { account, profile, profileEvent, publish, updateProfileEvent } = useNostr()
  const [banner, setBanner] = useState<string>('')
  const [avatar, setAvatar] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [about, setAbout] = useState<string>('')
  const [nip05, setNip05] = useState<string>('')
  const [nip05Error, setNip05Error] = useState<string>('')
  const [hasChanged, setHasChanged] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const defaultImage = useMemo(
    () => (account ? generateImageByPubkey(account.pubkey) : undefined),
    [account]
  )

  useEffect(() => {
    if (profile) {
      setBanner(profile.banner ?? '')
      setAvatar(profile.avatar ?? '')
      setUsername(profile.original_username ?? '')
      setAbout(profile.about ?? '')
      setNip05(profile.nip05 ?? '')
    } else {
      setBanner('')
      setAvatar('')
      setUsername('')
      setAbout('')
      setNip05('')
    }
  }, [profile])

  if (!account || !profile) return null

  const save = async () => {
    if (nip05 && !EMAIL_REGEX.test(nip05)) {
      setNip05Error(t('Invalid NIP-05 address'))
      return
    }
    setSaving(true)
    setHasChanged(false)
    const oldProfileContent = profileEvent ? JSON.parse(profileEvent.content) : {}
    const newProfileContent = {
      ...oldProfileContent,
      display_name: username,
      displayName: username,
      name: oldProfileContent.name ?? username,
      about,
      nip05,
      banner,
      picture: avatar
    }
    const profileDraftEvent = createProfileDraftEvent(
      JSON.stringify(newProfileContent),
      profileEvent?.tags
    )
    const newProfileEvent = await publish(profileDraftEvent)
    updateProfileEvent(newProfileEvent)
    setSaving(false)
    pop()
  }

  const onBannerUploadSuccess = ({ url }: { url: string }) => {
    setBanner(url)
    setHasChanged(true)
  }

  const onAvatarUploadSuccess = ({ url }: { url: string }) => {
    setAvatar(url)
    setHasChanged(true)
  }

  const controls = (
    <div className="pr-3">
      <Button className="w-16 rounded-full" onClick={save} disabled={saving || !hasChanged}>
        {saving ? <Loader className="animate-spin" /> : t('Save')}
      </Button>
    </div>
  )

  return (
    <SecondaryPageLayout ref={ref} index={index} title={profile.username} controls={controls}>
      <div className="px-4">
        <div className="relative bg-cover bg-center w-full aspect-[21/9] rounded-lg mb-2">
          <Uploader
            onUploadSuccess={onBannerUploadSuccess}
            onUploadingChange={(uploading) => setTimeout(() => setUploadingBanner(uploading), 50)}
            className="w-full relative cursor-pointer"
          >
            <ProfileBanner
              banner={banner}
              pubkey={account.pubkey}
              className="w-full aspect-video object-cover rounded-lg"
            />
            <div className="absolute top-0 bg-muted/30 w-full h-full rounded-lg flex flex-col justify-center items-center">
              {uploadingBanner ? (
                <Loader size={36} className="animate-spin" />
              ) : (
                <Upload size={36} />
              )}
            </div>
          </Uploader>
          <Uploader
            onUploadSuccess={onAvatarUploadSuccess}
            onUploadingChange={(uploading) => setTimeout(() => setUploadingAvatar(uploading), 50)}
            className="w-24 h-24 absolute bottom-0 left-4 translate-y-1/2 border-4 border-background cursor-pointer rounded-full"
          >
            <Avatar className="w-full h-full">
              <AvatarImage src={avatar} className="object-cover object-center" />
              <AvatarFallback>
                <img src={defaultImage} />
              </AvatarFallback>
            </Avatar>
            <div className="absolute top-0 bg-muted/30 w-full h-full rounded-full flex flex-col justify-center items-center">
              {uploadingAvatar ? <Loader className="animate-spin" /> : <Upload />}
            </div>
          </Uploader>
        </div>
        <div className="pt-14 space-y-4">
          <Item>
            <ItemTitle>{t('Display Name')}</ItemTitle>
            <Input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value)
                setHasChanged(true)
              }}
            />
          </Item>
          <Item>
            <ItemTitle>{t('Bio')}</ItemTitle>
            <Textarea
              className="h-44"
              value={about}
              onChange={(e) => {
                setAbout(e.target.value)
                setHasChanged(true)
              }}
            />
          </Item>
          <Item>
            <ItemTitle>{t('Nostr Address (NIP-05)')}</ItemTitle>
            <Input
              value={nip05}
              onChange={(e) => {
                setNip05Error('')
                setNip05(e.target.value)
                setHasChanged(true)
              }}
              className={nip05Error ? 'border-destructive' : ''}
            />
            {nip05Error && <div className="text-xs text-destructive pl-3">{nip05Error}</div>}
          </Item>
        </div>
      </div>
    </SecondaryPageLayout>
  )
})
ProfileEditorPage.displayName = 'ProfileEditorPage'
export default ProfileEditorPage

function ItemTitle({ children }: { children: React.ReactNode }) {
  return <div className="text-sm font-semibold text-muted-foreground pl-3">{children}</div>
}

function Item({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>
}
