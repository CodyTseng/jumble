import SlashCommandList from '@/components/SlashCommandList'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { userIdToPubkey } from '@/lib/pubkey'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

const SlashCommandsPage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  return (
    <SecondaryPageLayout
      ref={ref}
      index={index}
      title={t(id ? 'Slash commands' : 'Saved commands')}
    >
      <SlashCommandList executor={id ? userIdToPubkey(id) : undefined} />
    </SecondaryPageLayout>
  )
})
SlashCommandsPage.displayName = 'SlashCommandsPage'
export default SlashCommandsPage
