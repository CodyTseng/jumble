import storage from '@/services/local-storage.service'
import { ExternalLink, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const PSSTPSST_URL = 'https://psstpsst.chat/'

export default function PsstPsstPromotion() {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => storage.getDismissedPsstPsstPromotion())

  if (dismissed) return null

  const handleDismiss = () => {
    storage.setDismissedPsstPsstPromotion(true)
    setDismissed(true)
  }

  return (
    <aside className="flex items-start gap-3 border-b px-4 py-3" aria-label="PsstPsst">
      <PsstPsstLogo className="mt-0.5 size-9 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="text-sm font-semibold">PsstPsst</div>
          <a
            href={PSSTPSST_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            {t('Try PsstPsst')}
            <ExternalLink className="size-3" />
          </a>
        </div>
        <p className="text-muted-foreground mt-0.5 text-xs leading-5">
          {t(
            'For a smoother, more reliable DM experience, try PsstPsst, a dedicated Nostr messenger.'
          )}
        </p>
      </div>
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground -me-1 shrink-0 rounded-md p-1 transition-colors"
        onClick={handleDismiss}
        aria-label={t('Dismiss')}
      >
        <X className="size-4" />
      </button>
    </aside>
  )
}

function PsstPsstLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 1024 1024"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M511.5 208C677.462 208 812 342.538 812 508.5C812 674.462 677.462 809 511.5 809C473.966 809 438.038 802.118 404.91 789.547C401.965 788.429 396.597 788.027 389.185 790.965C387.34 791.696 384.277 793.301 380.27 795.378C376.277 797.447 371.377 799.968 365.897 802.506C354.944 807.579 341.641 812.735 328.566 814.495C315.535 816.249 304.46 816.007 296.618 813.857C288.794 811.712 284 807.595 284 801.5C284 799.955 284.631 797.917 285.614 795.531C286.604 793.129 287.983 790.302 289.537 787.159C292.65 780.862 296.481 773.261 299.41 765.068C305.272 748.673 307.463 730.083 293.188 714.996C242.242 661.154 211 588.475 211 508.5C211 342.538 345.538 208 511.5 208ZM667.23 356.104C659.428 348.285 646.765 348.271 638.946 356.073C631.128 363.875 631.114 376.539 638.916 384.357C671.431 416.942 691.5 461.858 691.5 511.5C691.5 561.091 671.472 605.966 639.016 638.542C631.22 646.367 631.244 659.03 639.068 666.826C646.893 674.622 659.557 674.598 667.353 666.773C706.973 627.006 731.5 572.098 731.5 511.5C731.5 450.84 706.923 395.881 667.23 356.104ZM596.604 426.899C588.817 419.066 576.154 419.029 568.32 426.816C560.487 434.604 560.45 447.267 568.237 455.101C582.637 469.586 591.5 489.488 591.5 511.5C591.5 533.512 582.637 553.414 568.237 567.899C560.45 575.733 560.487 588.396 568.32 596.184C576.154 603.971 588.817 603.934 596.604 596.101C618.151 574.427 631.5 544.503 631.5 511.5C631.5 478.497 618.151 448.573 596.604 426.899Z"
        fill="#3A76F0"
      />
    </svg>
  )
}
