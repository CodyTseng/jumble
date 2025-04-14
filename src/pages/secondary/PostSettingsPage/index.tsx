import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import MediaUploadServiceSetting from './MediaUploadServiceSetting'

const PostSettingsPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('Post settings')}>
      <div className="px-4 pt-2 space-y-4">
        <MediaUploadServiceSetting />
      </div>
    </SecondaryPageLayout>
  )
})
PostSettingsPage.displayName = 'PostSettingsPage'
export default PostSettingsPage
