import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createProfileDraftEvent } from '@/lib/draft-event'
import { isEmail } from '@/lib/utils'
import { useNostr } from '@/providers/NostrProvider'
import { Loader } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

export default function LightningAddressInput() {
  const { t } = useTranslation()
  const { profile, profileEvent, publish, updateProfileEvent } = useNostr()
  const [lightningAddress, setLightningAddress] = useState('')
  const [hasChanged, setHasChanged] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setLightningAddress(profile.lightningAddress || '')
    }
  }, [profile])

  if (!profile || !profileEvent) {
    return null
  }

  const handleSave = async () => {
    setSaving(true)
    const profileContent = profileEvent ? JSON.parse(profileEvent.content) : {}
    if (lightningAddress.startsWith('lnurl')) {
      profileContent.lud06 = lightningAddress
    } else if (isEmail(lightningAddress)) {
      profileContent.lud16 = lightningAddress
    } else if (lightningAddress) {
      toast.error(t('Invalid Lightning Address. Please enter a valid Lightning Address or LNURL.'))
      setSaving(false)
      return
    } else {
      delete profileContent.lud16
    }

    const profileDraftEvent = createProfileDraftEvent(
      JSON.stringify(profileContent),
      profileEvent?.tags
    )
    const newProfileEvent = await publish(profileDraftEvent)
    await updateProfileEvent(newProfileEvent)
    setSaving(false)
  }

  return (
    <div className="w-full space-y-1">
      <Label htmlFor="ln-address">{t('Lightning Address (or LNURL)')}</Label>
      <div className="flex w-full items-center gap-2">
        <Input
          id="ln-address"
          placeholder="xxxxxxxx@xxx.xxx"
          value={lightningAddress}
          onChange={(e) => {
            setLightningAddress(e.target.value)
            setHasChanged(true)
          }}
        />
        <Button onClick={handleSave} disabled={saving || !hasChanged} className="w-20">
          {saving ? <Loader className="animate-spin" /> : t('Save')}
        </Button>
      </div>
    </div>
  )
}
