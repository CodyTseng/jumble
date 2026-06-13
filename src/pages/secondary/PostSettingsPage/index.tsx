import {
  SettingsGroup,
  SettingsPageContainer
} from '@/components/ui/settings'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { useMediaUploadService } from '@/providers/MediaUploadServiceProvider'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import BlossomServerListSetting from './BlossomServerListSetting'
import MediaUploadServiceSetting from './MediaUploadServiceSetting'

const PostSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { serviceConfig } = useMediaUploadService()
  const isBlossom = serviceConfig.type === 'blossom'

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Media servers')}>
      <SettingsPageContainer>
        <SettingsGroup title={t('Media upload')}>
          <MediaUploadServiceSetting />
        </SettingsGroup>
        {isBlossom && (
          <SettingsGroup
            title={t('Blossom servers')}
            description={t(
              'Media is uploaded to the preferred server and mirrored to the others.'
            )}
          >
            <BlossomServerListSetting />
          </SettingsGroup>
        )}
      </SettingsPageContainer>
    </SecondaryPageLayout>
  )
})
PostSettingsPage.displayName = 'PostSettingsPage'
export default PostSettingsPage
