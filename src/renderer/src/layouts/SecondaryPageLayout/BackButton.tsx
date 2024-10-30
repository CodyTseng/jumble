import { TitlebarButton } from '@renderer/components/Titlebar'
import { useSecondaryPage } from '@renderer/PageManager'
import { ChevronLeft } from 'lucide-react'

export default function BackButton({ hide = false }: { hide?: boolean }) {
  const { pop } = useSecondaryPage()

  return (
    <>
      {!hide && (
        <TitlebarButton onClick={() => pop()}>
          <ChevronLeft />
        </TitlebarButton>
      )}
    </>
  )
}
