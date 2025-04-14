import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { DEFAULT_NIP_96_SERVICE, NIP_96_SERVICE } from '@/constants'
import { simplifyUrl } from '@/lib/url'
import { useMediaUploadService } from '@/providers/MediaUploadServiceProvider'
import { useTranslation } from 'react-i18next'

export default function MediaUploadServiceSetting() {
  const { t } = useTranslation()
  const { service, updateService } = useMediaUploadService()

  return (
    <div className="space-y-2">
      <Label htmlFor="media-upload-service-select">{t('Media upload service')}</Label>
      <Select defaultValue={DEFAULT_NIP_96_SERVICE} value={service} onValueChange={updateService}>
        <SelectTrigger id="media-upload-service-select" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NIP_96_SERVICE.map((url) => (
            <SelectItem key={url} value={url}>
              {simplifyUrl(url)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
