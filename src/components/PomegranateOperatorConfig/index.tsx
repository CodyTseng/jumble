import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DEFAULT_POMEGRANATE_OPERATORS,
  normalizePomegranateOperatorUrl,
  pomegranateOperatorLabel
} from '@/lib/pomegranate'
import { cn } from '@/lib/utils'
import { CircleX, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const MIN_OPERATORS = 2

/**
 * Operators + signing-threshold fields for a pomegranate account. Renders bare
 * sections (no disclosure wrapper) so callers can place it inside a shared
 * `AdvancedOptions`, optionally alongside other fields like the central server.
 *
 * Operators and threshold are controlled by the parent so it can pass them to
 * the service. The recommended (default) operators that are not currently
 * selected are offered as one-tap chips; removing one returns it there.
 */
export default function PomegranateOperatorConfig({
  operators,
  onOperatorsChange,
  threshold,
  onThresholdChange,
  disabled
}: {
  operators: string[]
  onOperatorsChange: (next: string[]) => void
  threshold: number
  onThresholdChange: (next: number) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState('')
  const [addError, setAddError] = useState('')

  const recommended = DEFAULT_POMEGRANATE_OPERATORS.filter((url) => !operators.includes(url))
  const clamp = (n: number, count: number) => Math.max(MIN_OPERATORS, Math.min(n, count))

  const setOperators = (next: string[]) => {
    onOperatorsChange(next)
    if (threshold > next.length) {
      onThresholdChange(clamp(threshold, next.length))
    }
  }

  const addOperator = (raw: string) => {
    let url: string
    try {
      url = normalizePomegranateOperatorUrl(raw)
    } catch {
      setAddError(t('Invalid URL'))
      return
    }
    if (operators.includes(url)) {
      setAddError(t('This operator is already added'))
      return
    }
    setAddError('')
    setDraft('')
    setOperators([...operators, url])
  }

  return (
    <>
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {t('Operators')}
        </div>
        <p className="text-muted-foreground text-xs">
          {t(
            'Independent servers that each hold a shard of your private key, so no single operator can sign on its own.'
          )}
        </p>
        <div>
          {operators.map((url) => (
            <div key={url} className="flex items-center justify-between py-1 ps-1 pe-1">
              <div className="text-muted-foreground truncate text-sm">
                {pomegranateOperatorLabel(url)}
              </div>
              <button
                type="button"
                disabled={disabled || operators.length <= MIN_OPERATORS}
                onClick={() => setOperators(operators.filter((o) => o !== url))}
                title={t('Remove')}
                className="shrink-0 disabled:opacity-40"
              >
                <CircleX
                  size={16}
                  className="text-muted-foreground hover:text-destructive cursor-pointer"
                />
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            className={cn('h-9', addError && 'border-destructive')}
            placeholder={t('Add operator URL')}
            value={draft}
            disabled={disabled}
            onChange={(e) => {
              setDraft(e.target.value)
              setAddError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addOperator(draft)
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={disabled || !draft.trim()}
            onClick={() => addOperator(draft)}
          >
            {t('Add')}
          </Button>
        </div>
        {addError && <div className="text-destructive text-xs">{addError}</div>}

        {recommended.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-muted-foreground text-xs">{t('Recommended')}</div>
            <div className="flex flex-wrap gap-2">
              {recommended.map((url) => (
                <Button
                  key={url}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={disabled}
                  onClick={() => addOperator(url)}
                >
                  <Plus className="me-1 size-3" />
                  {pomegranateOperatorLabel(url)}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {t('Signing threshold')}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-8"
              disabled={disabled || threshold <= MIN_OPERATORS}
              onClick={() => onThresholdChange(clamp(threshold - 1, operators.length))}
            >
              <Minus className="size-4" />
            </Button>
            <span className="min-w-6 text-center text-base font-semibold tabular-nums">
              {threshold}
            </span>
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="size-8"
              disabled={disabled || threshold >= operators.length}
              onClick={() => onThresholdChange(clamp(threshold + 1, operators.length))}
            >
              <Plus className="size-4" />
            </Button>
          </div>
          <span className="text-muted-foreground text-sm">
            {t('of {{total}} operators are enough to sign', { total: operators.length })}
          </span>
        </div>
      </div>
    </>
  )
}
