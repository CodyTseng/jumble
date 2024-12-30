import { Button } from '@/components/ui/button'
import { useSecondaryPage } from '@/PageManager'
import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export default function BackButton({
  hide = false,
  children
}: {
  hide?: boolean
  children?: React.ReactNode
}) {
  const { t } = useTranslation()
  const { pop } = useSecondaryPage()

  return (
    <>
      {!hide && (
        <Button
          className="flex gap-1 items-center w-fit max-w-full justify-start pl-2 pr-3"
          variant="ghost"
          size="titlebar-icon"
          title={t('back')}
          onClick={() => pop()}
        >
          <ChevronLeft />
          <div className="truncate text-lg font-semibold">{children}</div>
        </Button>
      )}
    </>
  )
}
