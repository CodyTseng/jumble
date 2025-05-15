import { useTranslation } from 'react-i18next'
import Image from '../Image'

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
              url: 'https://github.com/OpenSats/website/blob/master/public/static/images/projects/opensats_logo.png?raw=true'
            }}
            className="h-14"
          />
          <div className="text-3xl font-bold">OpenSats</div>
        </div>
      </div>
    </div>
  )
}
