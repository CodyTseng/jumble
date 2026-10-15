import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import type { NappletConfig } from '@/lib/napplet/vendor/runtime/src/config-session'
import type { ConfigSchema, ConfigValues } from '@/lib/napplet/vendor/runtime/src/config-schema'
import { useId, useSyncExternalStore, useLayoutEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings2 } from 'lucide-react'

export function ConfigButton({ config }: { config: NappletConfig }) {
  const view = useSyncExternalStore(config.subscribeView, config.getSnapshot)
  const { t } = useTranslation()
  if (!view.schema || !Object.keys(view.schema.properties ?? {}).length) return null
  return (
    <Button
      size="titlebar-icon"
      variant="ghost"
      title={t('Settings')}
      onClick={() => config.open()}
    >
      <Settings2 />
    </Button>
  )
}

function Fields({
  schema,
  values,
  path = []
}: {
  schema: ConfigSchema
  values: ConfigValues
  path?: string[]
}) {
  const prefix = useId()
  const { t } = useTranslation()
  return (
    <>
      {Object.entries(schema.properties ?? {})
        .sort(
          ([, a], [, b]) => (a['x-napplet-order'] ?? Infinity) - (b['x-napplet-order'] ?? Infinity)
        )
        .map(([key, field]) => {
          const parts = [...path, key]
          const name = JSON.stringify(parts)
          const id = `${prefix}-${name}`
          const value = values[key]
          const required = schema.required?.includes(key)
          if (field.type === 'object')
            return (
              <fieldset key={name} className="space-y-3 rounded border p-3">
                <legend dir="auto">{field.title ?? key}</legend>
                <Fields schema={field} values={(value as ConfigValues) ?? {}} path={parts} />
              </fieldset>
            )
          const className = 'w-full rounded border bg-background p-2'
          return (
            <div key={name} className="space-y-1">
              <label htmlFor={id} dir="auto" className="block font-medium">
                {field.title ?? key}
                {required ? ' *' : ''}
              </label>
              {field.enum || field.type === 'boolean' ? (
                <select
                  className={className}
                  id={id}
                  name={name}
                  required={required}
                  defaultValue={value === undefined ? '' : JSON.stringify(value)}
                >
                  <option value="">{t('Not set')}</option>
                  {(field.enum ?? [true, false]).map((item, i) => (
                    <option key={i} value={JSON.stringify(item)}>
                      {field.enumDescriptions?.[i] ??
                        (typeof item === 'boolean' ? t(item ? 'On' : 'Off') : String(item))}
                    </option>
                  ))}
                </select>
              ) : field.type === 'array' ? (
                <textarea
                  className={className}
                  id={id}
                  name={name}
                  required={required}
                  data-kind="array"
                  defaultValue={value === undefined ? '' : JSON.stringify(value)}
                />
              ) : (
                <input
                  className={className}
                  id={id}
                  name={name}
                  required={required}
                  type={
                    field['x-napplet-secret']
                      ? 'password'
                      : ['integer', 'number'].includes(field.type)
                        ? 'number'
                        : 'text'
                  }
                  autoComplete="off"
                  min={field.minimum}
                  max={field.maximum}
                  minLength={field.minLength}
                  maxLength={field.maxLength}
                  step={field.type === 'integer' ? 1 : 'any'}
                  defaultValue={value === undefined ? '' : String(value)}
                />
              )}
              {field.description && (
                <p dir="auto" className="text-muted-foreground text-sm">
                  {field.description}
                </p>
              )}
            </div>
          )
        })}
    </>
  )
}

export default function ConfigControls({ config }: { config: NappletConfig }) {
  const view = useSyncExternalStore(config.subscribeView, config.getSnapshot)
  useLayoutEffect(() => {
    if (view.open && document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [view.open])
  const { t } = useTranslation()
  return (
    <Dialog
      open={view.open}
      onOpenChange={(open) => {
        if (!open) config.dismiss()
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{t('Napplet settings')}</DialogTitle>
          <DialogDescription dir="auto">
            {view.schema?.description ?? t('Settings')}
          </DialogDescription>
        </DialogHeader>
        {view.schema && (
          <form
            key={view.revision}
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              const values: ConfigValues = {}
              let invalid = false
              e.currentTarget
                .querySelectorAll<
                  HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
                >('[name]')
                .forEach((input) => {
                  if (!input.value) return
                  const parts: string[] = JSON.parse(input.name)
                  let target = values
                  for (const part of parts.slice(0, -1))
                    target = (target[part] ??= {}) as ConfigValues
                  try {
                    target[parts[parts.length - 1]] =
                      input instanceof HTMLSelectElement || input.dataset.kind === 'array'
                        ? JSON.parse(input.value)
                        : input instanceof HTMLInputElement && input.type === 'number'
                          ? Number(input.value)
                          : input.value
                  } catch {
                    invalid = true
                  }
                })
              config.commit(invalid ? null : values)
            }}
          >
            <Fields schema={view.schema} values={view.values} />
            {view.error && (
              <p role="alert" className="text-destructive">
                {view.error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => config.reset()}>
                {t('Reset')}
              </Button>
              <Button type="submit">{t('Save')}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
