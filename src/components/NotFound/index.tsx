import { useTranslation } from 'react-i18next'

export default function NotFound() {
  const { t } = useTranslation()

  return (
    <div className="text-muted-foreground w-full h-full flex flex-col items-center justify-center gap-2">
      <div>{t('Lost in the void')} 🌌</div>
      <div>(404)</div>
    </div>
  )
}
