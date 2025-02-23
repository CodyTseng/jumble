import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useZap } from '@/providers/ZapProvider'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function DefaultZapCommentInput() {
  const { t } = useTranslation()
  const { defaultZapComment, updateDefaultComment } = useZap()
  const [defaultZapCommentInput, setDefaultZapCommentInput] = useState(defaultZapComment)

  return (
    <div className="w-full space-y-1">
      <Label htmlFor="default-zap-comment-input">{t('Default zap comment')}</Label>
      <div className="flex w-full items-center gap-2">
        <Input
          id="default-zap-comment-input"
          value={defaultZapCommentInput}
          onChange={(e) => setDefaultZapCommentInput(e.target.value)}
          onBlur={() => {
            updateDefaultComment(defaultZapCommentInput)
          }}
        />
      </div>
    </div>
  )
}
