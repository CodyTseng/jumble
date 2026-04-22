import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTrigger } from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useScreenSize } from '@/providers/ScreenSizeProvider'
import { useUserTrust } from '@/providers/UserTrustProvider'
import { Shield, ShieldCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const TRUST_LEVELS = [
  { value: 0, label: 'trust-filter.off' },
  { value: 60, label: 'trust-filter.low' },
  { value: 80, label: 'trust-filter.medium' },
  { value: 90, label: 'trust-filter.high' },
  { value: 100, label: 'trust-filter.wot' }
]

function getDescription(score: number, t: (key: string, options?: any) => string) {
  if (score === 0) {
    return t('trust-filter.show-all-content')
  } else if (score === 100) {
    return t('trust-filter.only-show-wot')
  } else {
    return t('trust-filter.hide-bottom-percent', { score })
  }
}

export default function TrustScoreFilter({
  filterId,
  onOpenChange
}: {
  filterId: string
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { getMinTrustScore, updateMinTrustScore } = useUserTrust()
  const [open, setOpen] = useState(false)
  const [temporaryScore, setTemporaryScore] = useState(0)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setTemporaryScore(getMinTrustScore(filterId))
  }, [getMinTrustScore, filterId])

  // Debounced update function
  const handleScoreChange = (newScore: number) => {
    setTemporaryScore(newScore)

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer for debounced update
    debounceTimerRef.current = setTimeout(() => {
      updateMinTrustScore(filterId, newScore)
    }, 300) // 300ms debounce delay
  }

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (onOpenChange) {
      onOpenChange(open)
    }
  }, [open, onOpenChange])

  const description = getDescription(temporaryScore, t)

  const trigger = (
    <Button
      variant="ghost"
      size="titlebar-icon"
      className={cn(
        'relative',
        temporaryScore === 0
          ? 'text-muted-foreground hover:text-foreground'
          : 'text-primary hover:text-primary-hover'
      )}
      onClick={() => {
        setOpen(true)
      }}
    >
      {temporaryScore < 100 ? <Shield size={16} /> : <ShieldCheck size={16} />}
      {temporaryScore > 0 && temporaryScore < 100 && (
        <div className="absolute inset-0 flex h-full w-full flex-col items-center justify-center font-mono text-[0.5rem] font-bold">
          {temporaryScore}
        </div>
      )}
    </Button>
  )

  const content = (
    <>
      {/* Slider */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">
            {t('trust-filter.filter-threshold')}
          </span>
          <span className="text-lg font-semibold text-primary">
            {temporaryScore === 0 ? t('trust-filter.off') : `${temporaryScore}%`}
          </span>
        </div>
        <Slider
          value={[temporaryScore]}
          onValueChange={([value]) => handleScoreChange(value)}
          min={0}
          max={100}
          step={5}
          className="w-full"
        />
      </div>

      {/* Quick Presets */}
      <div className="space-y-1.5">
        <div className="text-xs text-muted-foreground">{t('trust-filter.quick-presets')}</div>
        <div className="flex flex-wrap gap-1.5">
          {TRUST_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => handleScoreChange(level.value)}
              className={cn(
                'flex-1 rounded px-2 py-1.5 text-center text-xs transition-all duration-200',
                temporaryScore === level.value
                  ? 'bg-primary font-medium text-primary-foreground shadow-xs'
                  : 'bg-secondary hover:scale-[1.02] hover:bg-secondary/80 hover:shadow-xs'
              )}
            >
              {t(level.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1 border-t pt-2">
        <div className="text-sm font-medium text-foreground">{description}</div>
        <div className="text-xs text-muted-foreground">
          {t('trust-filter.trust-score-description')}
        </div>
      </div>
    </>
  )

  if (isSmallScreen) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerTrigger asChild></DrawerTrigger>
          <DrawerContent className="px-4 pb-4">
            <DrawerHeader className="text-base font-semibold">
              {t('trust-filter.title')}
            </DrawerHeader>
            <div className="space-y-4 pb-4">{content}</div>
          </DrawerContent>
        </Drawer>
      </>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-96 space-y-4 p-4" collisionPadding={16} sideOffset={0}>
        {content}
      </PopoverContent>
    </Popover>
  )
}
