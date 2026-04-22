import Uploader from '@/components/PostEditor/Uploader'
import ProfileBanner from '@/components/ProfileBanner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { createProfileDraftEvent } from '@/lib/draft-event'
import { formatError } from '@/lib/error'
import { generateImageByPubkey } from '@/lib/pubkey'
import { isEmail } from '@/lib/utils'
import { useSecondaryPage } from '@/PageManager'
import { useNostr } from '@/providers/NostrProvider'
import { Loader, Upload } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

const ProfileEditorPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pop } = useSecondaryPage()
  const { account, profile, profileEvent, publish, updateProfileEvent } = useNostr()
  const [banner, setBanner] = useState<string>('')
  const [avatar, setAvatar] = useState<string>('')
  const [username, setUsername] = useState<string>('')
  const [about, setAbout] = useState<string>('')
  const [website, setWebsite] = useState<string>('')
  const [nip05, setNip05] = useState<string>('')
  const [nip05Error, setNip05Error] = useState<string>('')
  const [lightningAddress, setLightningAddress] = useState<string>('')
  const [lightningAddressError, setLightningAddressError] = useState<string>('')
  const [silentPaymentAddress, setSilentPaymentAddress] = useState<string>('')
  const [silentPaymentAddressError, setSilentPaymentAddressError] = useState<string>('')
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
      setWebsite(profile.website ?? '')
      setNip05(profile.nip05 ?? '')
      setLightningAddress(profile.lightningAddress || '')
      setSilentPaymentAddress(profile.sp || '')
    } else {
      setBanner('')
      setAvatar('')
      setUsername('')
      setAbout('')
      setWebsite('')
      setNip05('')
      setLightningAddress('')
      setSilentPaymentAddress('')
    }
  }, [profile])

  if (!account || !profile) return null

  const save = async () => {
    if (nip05 && !isEmail(nip05)) {
      setNip05Error(t('Invalid NIP-05 address'))
      return
    }

    const oldProfileContent = profileEvent ? JSON.parse(profileEvent.content) : {}
    const newProfileContent = {
      ...oldProfileContent,
      display_name: username,
      displayName: username,
      name: username,
      about,
      website,
      nip05,
      banner,
      picture: avatar
    }

    if (lightningAddress) {
      if (isEmail(lightningAddress)) {
        newProfileContent.lud16 = lightningAddress
      } else if (lightningAddress.startsWith('lnurl')) {
        newProfileContent.lud06 = lightningAddress
      } else {
        setLightningAddressError(t('Invalid Lightning Address'))
        return
      }
    } else {
      delete newProfileContent.lud16
    }

    if (silentPaymentAddress) {
      if (silentPaymentAddress.startsWith('sp1')) {
        newProfileContent.sp = silentPaymentAddress
      } else {
        setSilentPaymentAddressError(t('Silent Payment address must start with sp1'))
        return
      }
    } else {
      delete newProfileContent.sp
    }

    setSaving(true)
    setHasChanged(false)
    const profileDraftEvent = createProfileDraftEvent(
      JSON.stringify(newProfileContent),
      profileEvent?.tags
    )
    try {
      const newProfileEvent = await publish(profileDraftEvent)
      await updateProfileEvent(newProfileEvent)
      setSaving(false)
      pop()
    } catch (error) {
      const errors = formatError(error)
      errors.forEach((err) => {
        toast.error(`${t('Failed to save profile')}: ${err}`, { duration: 10_000 })
      })
    }
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
      <div className="relative mb-2 bg-cover bg-center">
        <Uploader
          onUploadSuccess={onBannerUploadSuccess}
          onUploadStart={() => setUploadingBanner(true)}
          onUploadEnd={() => setUploadingBanner(false)}
          className="relative w-full cursor-pointer"
        >
          <ProfileBanner banner={banner} pubkey={account.pubkey} className="aspect-3/1 w-full" />
          <div className="absolute top-0 flex h-full w-full flex-col items-center justify-center bg-muted/30">
            {uploadingBanner ? <Loader size={36} className="animate-spin" /> : <Upload size={36} />}
          </div>
        </Uploader>
        <Uploader
          onUploadSuccess={onAvatarUploadSuccess}
          onUploadStart={() => setUploadingAvatar(true)}
          onUploadEnd={() => setUploadingAvatar(false)}
          className="absolute bottom-0 left-4 h-24 w-24 translate-y-1/2 cursor-pointer rounded-full border-4 border-background"
        >
          <Avatar className="h-full w-full">
            <AvatarImage src={avatar} className="object-cover object-center" />
            <AvatarFallback>
              <img src={defaultImage} />
            </AvatarFallback>
          </Avatar>
          <div className="absolute top-0 flex h-full w-full flex-col items-center justify-center rounded-full bg-muted/30">
            {uploadingAvatar ? <Loader className="animate-spin" /> : <Upload />}
          </div>
        </Uploader>
      </div>
      <div className="flex flex-col gap-4 px-4 pt-14">
        <Item>
          <Label htmlFor="profile-username-input">{t('Display Name')}</Label>
          <Input
            id="profile-username-input"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value)
              setHasChanged(true)
            }}
          />
        </Item>
        <Item>
          <Label htmlFor="profile-about-textarea">{t('Bio')}</Label>
          <Textarea
            id="profile-about-textarea"
            className="h-44"
            value={about}
            onChange={(e) => {
              setAbout(e.target.value)
              setHasChanged(true)
            }}
          />
        </Item>
        <Item>
          <Label htmlFor="profile-website-input">{t('Website')}</Label>
          <Input
            id="profile-website-input"
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value)
              setHasChanged(true)
            }}
          />
        </Item>
        <Item>
          <Label htmlFor="profile-nip05-input">{t('Nostr Address (NIP-05)')}</Label>
          <Input
            id="profile-nip05-input"
            value={nip05}
            onChange={(e) => {
              setNip05Error('')
              setNip05(e.target.value)
              setHasChanged(true)
            }}
            className={nip05Error ? 'border-destructive' : ''}
          />
          {nip05Error && <div className="pl-3 text-xs text-destructive">{nip05Error}</div>}
        </Item>
        <Item>
          <Label htmlFor="profile-lightning-address-input">
            {t('Lightning Address (or LNURL)')}
          </Label>
          <Input
            id="profile-lightning-address-input"
            value={lightningAddress}
            onChange={(e) => {
              setLightningAddressError('')
              setLightningAddress(e.target.value)
              setHasChanged(true)
            }}
            className={lightningAddressError ? 'border-destructive' : ''}
          />
          {lightningAddressError && (
            <div className="pl-3 text-xs text-destructive">{lightningAddressError}</div>
          )}
        </Item>
        <Item>
          <Label htmlFor="profile-sp-address-input">
            {t('Silent Payment Address (BIP 352)')}
          </Label>
          <Input
            id="profile-sp-address-input"
            value={silentPaymentAddress}
            placeholder="sp1qq..."
            onChange={(e) => {
              setSilentPaymentAddressError('')
              setSilentPaymentAddress(e.target.value)
              setHasChanged(true)
            }}
            className={silentPaymentAddressError ? 'border-destructive' : ''}
          />
          {silentPaymentAddressError && (
            <div className="pl-3 text-xs text-destructive">{silentPaymentAddressError}</div>
          )}
        </Item>
      </div>
    </SecondaryPageLayout>
  )
})
ProfileEditorPage.displayName = 'ProfileEditorPage'
export default ProfileEditorPage

function Item({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2">{children}</div>
}
