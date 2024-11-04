import { Button } from '@renderer/components/ui/button'
import { useSecondaryPage } from '@renderer/PageManager'
import { ChevronLeft } from 'lucide-react'

export default function BackButton({ hide = false }: { hide?: boolean }) {
  const { pop } = useSecondaryPage()

  return (
    <>
      {!hide && (
        <Button variant="titlebar" size="titlebar" title="back" onClick={() => pop()}>
          <ChevronLeft />
        </Button>
      )}
    </>
  )
}
