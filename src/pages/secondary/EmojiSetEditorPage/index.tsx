import EmojiRowsEditor, { emptyEmojiRow, TEmojiRow } from '@/components/EmojiRowsEditor'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFetchEvent } from '@/hooks'
import SecondaryPageLayout from '@/layouts/SecondaryPageLayout'
import { normalizeShortcode, validateEmojiUrl, validateShortcode } from '@/lib/emoji'
import { getEmojiPackInfoFromEvent } from '@/lib/event-metadata'
import { useSecondaryPage } from '@/PageManager'
import { useEmojiPack } from '@/providers/EmojiPackProvider'
import { useNostr } from '@/providers/NostrProvider'
import { Loader } from 'lucide-react'
import { forwardRef, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const EmojiSetEditorPage = forwardRef(({ id, index }: { id?: string; index?: number }, ref) => {
  const { t } = useTranslation()
  const { pop } = useSecondaryPage()
  const { pubkey } = useNostr()
  const { createEmojiSet, editEmojiSet } = useEmojiPack()
  const isEditing = !!id
  const { event, isFetching } = useFetchEvent(id)

  const [title, setTitle] = useState('')
  const [rows, setRows] = useState<TEmojiRow[]>([emptyEmojiRow()])
  const [prefilled, setPrefilled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const isOwner = !isEditing || (!!event && !!pubkey && event.pubkey === pubkey)

  useEffect(() => {
    if (!isEditing || prefilled || !event) return
    const { title, emojis } = getEmojiPackInfoFromEvent(event)
    setTitle(title ?? '')
    setRows(
      emojis.length > 0
        ? emojis.map((e) => ({ shortcode: e.shortcode, url: e.url }))
        : [emptyEmojiRow()]
    )
    setPrefilled(true)
  }, [isEditing, prefilled, event])

  const canSave = useMemo(
    () => title.trim().length > 0 && rows.some((r) => r.shortcode && r.url),
    [title, rows]
  )

  const save = async () => {
    const cleaned = rows
      .map((r) => ({ shortcode: normalizeShortcode(r.shortcode), url: r.url.trim() }))
      .filter((r) => r.shortcode || r.url)

    if (!title.trim()) {
      setError(t('Title is required'))
      return
    }
    if (cleaned.length === 0) {
      setError(t('At least one emoji is required'))
      return
    }
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
    const result =
      isEditing && event
        ? await editEmojiSet(event, title.trim(), cleaned)
        : await createEmojiSet(title.trim(), cleaned)
    setSaving(false)
    if (result) pop()
  }

  const controls = (
    <div className="pe-3">
      <Button className="rounded-full" onClick={save} disabled={saving || !canSave}>
        {saving ? <Loader className="animate-spin" /> : t('Save')}
      </Button>
    </div>
  )

  const pageTitle = isEditing ? t('Edit emoji set') : t('Create emoji set')

  if (isEditing && isFetching) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={pageTitle}>
        <div className="flex justify-center py-8">
          <Loader className="animate-spin" />
        </div>
      </SecondaryPageLayout>
    )
  }

  if (isEditing && (!event || !isOwner)) {
    return (
      <SecondaryPageLayout ref={ref} index={index} title={pageTitle}>
        <div className="text-muted-foreground p-4 text-center">
          {!event ? t('Emoji set not found') : t('You can only edit your own emoji sets')}
        </div>
      </SecondaryPageLayout>
    )
  }

  return (
    <SecondaryPageLayout ref={ref} index={index} title={pageTitle} controls={controls}>
      <div className="flex flex-col gap-4 px-4 py-3">
        <div className="grid gap-2">
          <Label htmlFor="emoji-set-title">{t('Title')}</Label>
          <Input
            id="emoji-set-title"
            value={title}
            placeholder={t('My emoji set')}
            onChange={(e) => {
              setError('')
              setTitle(e.target.value)
            }}
          />
        </div>

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
EmojiSetEditorPage.displayName = 'EmojiSetEditorPage'
export default EmojiSetEditorPage
