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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import BlossomServerListSetting from './BlossomServerListSetting'

const BLOSSOM = 'blossom'

export default function MediaUploadServiceSetting() {
  const { t } = useTranslation()
  const { serviceConfig, updateServiceConfig } = useMediaUploadService()
  const selectedValue = useMemo(() => {
    if (serviceConfig.type === 'blossom') {
      return BLOSSOM
    }
    return serviceConfig.service
  }, [serviceConfig])

  const handleSelectedValueChange = (value: string) => {
    if (value === BLOSSOM) {
      return updateServiceConfig({ type: 'blossom' })
    }
    return updateServiceConfig({ type: 'nip96', service: value })
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="media-upload-service-select">{t('Media upload service')}</Label>
      <Select
        defaultValue={DEFAULT_NIP_96_SERVICE}
        value={selectedValue}
        onValueChange={handleSelectedValueChange}
      >
        <SelectTrigger id="media-upload-service-select" className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={BLOSSOM}>{t('Blossom')}</SelectItem>
          {NIP_96_SERVICE.map((url) => (
            <SelectItem key={url} value={url}>
              {simplifyUrl(url)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedValue === BLOSSOM && <BlossomServerListSetting />}
    </div>
  )
}
