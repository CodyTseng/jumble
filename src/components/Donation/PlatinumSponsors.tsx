import { useTranslation } from 'react-i18next'
import Image from '../Image'
import OpenSatsLogo from './open-sats-logo.svg'

export default function PlatinumSponsors() {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <div className="font-semibold text-center">{t('Platinum Sponsors')}</div>
      <div className="flex flex-col gap-2 items-center">
        <div
          className="flex items-center gap-4 cursor-pointer"
          onClick={() => window.open('https://opensats.org/', '_blank')}
        >
          <Image
            image={{
              url: OpenSatsLogo
            }}
            className="h-11"
          />
          <div className="text-2xl font-semibold">OpenSats</div>
        </div>
      </div>
    </div>
  )
}
