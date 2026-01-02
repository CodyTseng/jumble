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
  onOpenChange
}: {
  onOpenChange?: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { isSmallScreen } = useScreenSize()
  const { minTrustScore, updateMinTrustScore } = useUserTrust()
  const [open, setOpen] = useState(false)
  const [temporaryScore, setTemporaryScore] = useState(minTrustScore)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setTemporaryScore(minTrustScore)
  }, [minTrustScore])

  // Debounced update function
  const handleScoreChange = (newScore: number) => {
    setTemporaryScore(newScore)

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Set new timer for debounced update
    debounceTimerRef.current = setTimeout(() => {
      updateMinTrustScore(newScore)
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
        minTrustScore === 0
          ? 'text-muted-foreground hover:text-foreground'
          : 'text-primary hover:text-primary-hover'
      )}
      onClick={() => {
        setOpen(true)
      }}
    >
      {minTrustScore < 100 ? <Shield size={16} /> : <ShieldCheck size={16} />}
      {minTrustScore > 0 && minTrustScore < 100 && (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center text-[0.55rem] font-mono font-bold">
          {minTrustScore}
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
                'text-center py-1.5 px-2 flex-1 rounded text-xs transition-all duration-200',
                temporaryScore === level.value
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'bg-secondary hover:bg-secondary/80 hover:shadow-sm hover:scale-[1.02]'
              )}
            >
              {t(level.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1 pt-2 border-t">
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
      <PopoverContent className="p-4 space-y-4 w-96" collisionPadding={16} sideOffset={0}>
        {content}
      </PopoverContent>
    </Popover>
  )
}
