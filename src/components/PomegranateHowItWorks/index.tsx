import { useTranslation } from 'react-i18next'
import InfoCard from '../InfoCard'

/**
 * Shared "How it works" explanation for the pomegranate (Login with Google)
 * flows, used by both the sign-in/sign-up screen and the bind-existing-account
 * dialog so the copy is maintained in one place.
 */
export default function PomegranateHowItWorks() {
  const { t } = useTranslation()
  return (
    <InfoCard
      title={t('How it works')}
      content={t(
        'Your private key is split into shards held by separate, independent operators, so it is never stored in one place. Google is only used to prove your identity to the operators, never to store your key.'
      )}
    />
  )
}
