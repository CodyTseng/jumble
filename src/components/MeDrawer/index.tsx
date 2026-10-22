import { Modal, ModalContent } from '@/components/ui/modal'
import { useTranslation } from 'react-i18next'
import MeDrawerContent from './MeDrawerContent'

export default function MeDrawer({
  open,
  setOpen
}: {
  open: boolean
  setOpen: (open: boolean) => void
}) {
  const { i18n, t } = useTranslation()
  const isRtl = i18n.dir() === 'rtl'
  return (
    <Modal open={open} onOpenChange={setOpen} direction={isRtl ? 'right' : 'left'}>
      <ModalContent title={t('Menu')}>
        <MeDrawerContent onClose={() => setOpen(false)} />
      </ModalContent>
    </Modal>
  )
}
