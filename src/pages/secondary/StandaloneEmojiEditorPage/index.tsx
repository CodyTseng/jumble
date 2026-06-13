import EmojiRowsEditor, { emptyEmojiRow, TEmojiRow } from '@/components/EmojiRowsEditor'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { useEmojiCollections } from '@/components/ExpressionPicker/useEmojiCollections'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { normalizeShortcode, validateEmojiUrl, validateShortcode } from '@/lib/emoji'
import { useSecondaryPage } from '@/PageManager'
import { useEmojiPack } from '@/providers/EmojiPackProvider'
import { Loader } from 'lucide-react'
import { forwardRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const StandaloneEmojiEditorPage = forwardRef(({ index }: { index?: number }, ref) => {
  const { t } = useTranslation()
  const { pop } = useSecondaryPage()
  const { standalone } = useEmojiCollections()
  const { setStandaloneEmojis } = useEmojiPack()

  const [rows, setRows] = useState<TEmojiRow[]>([emptyEmojiRow()])
  const [prefilled, setPrefilled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (prefilled) return
    setRows(
      standalone.length > 0
        ? standalone.map((e) => ({ shortcode: e.shortcode, url: e.url }))
        : [emptyEmojiRow()]
    )
    setPrefilled(true)
  }, [prefilled, standalone])

  const save = async () => {
    const cleaned = rows
      .map((r) => ({ shortcode: normalizeShortcode(r.shortcode), url: r.url.trim() }))
      .filter((r) => r.shortcode || r.url)

    const seen = new Set<string>()
    for (const r of cleaned) {
      const shortcodeError = validateShortcode(r.shortcode)
      if (shortcodeError) {
        setError(t(shortcodeError))
        return
      }
      const urlError = validateEmojiUrl(r.url)
      if (urlError) {
        setError(t(urlError))
        return
      }
      if (seen.has(r.shortcode)) {
        setError(t('Duplicate shortcode: {{shortcode}}', { shortcode: r.shortcode }))
        return
      }
      seen.add(r.shortcode)
    }

    setSaving(true)
    await setStandaloneEmojis(cleaned)
    setSaving(false)
    pop()
  }

  const controls = (
    <div className="pe-3">
      <Button className="rounded-full" onClick={save} disabled={saving}>
        {saving ? <Loader className="animate-spin" /> : t('Save')}
      </Button>
    </div>
  )

  return (
    <SecondaryPageLayout ref={ref} index={index} title={t('My emojis')} controls={controls}>
      <div className="flex flex-col gap-4 px-4 py-3">
        <div className="grid gap-2">
          <Label>{t('Emojis')}</Label>
          <EmojiRowsEditor
            rows={rows}
            onChange={(newRows) => {
              setError('')
              setRows(newRows)
            }}
          />
        </div>
        {error && <div className="text-destructive text-sm">{error}</div>}
      </div>
    </SecondaryPageLayout>
  )
})
StandaloneEmojiEditorPage.displayName = 'StandaloneEmojiEditorPage'
export default StandaloneEmojiEditorPage
