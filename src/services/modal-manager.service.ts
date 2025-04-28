class ModalManagerService {
  static instance: ModalManagerService

  private modals: { id: string; cb: () => void }[] = []

  constructor() {
    if (!ModalManagerService.instance) {
      ModalManagerService.instance = this
    }
    return ModalManagerService.instance
  }

  register(id: string, cb: () => void) {
    if (this.modals.find((m) => m.id === id)) {
      return
    }
    this.modals.push({ id, cb })
    console.debug('register modal', id, this.modals.length)
  }

  unregister(id: string) {
    const index = this.modals.findIndex((m) => m.id === id)
    if (index === -1) return

    const modal = this.modals.splice(index, 1)[0]
    modal.cb()
    console.debug('unregister modal', id, this.modals.length)
  }

  pop() {
    const last = this.modals.pop()
    if (!last) return false
    last.cb()
    console.debug('pop modal', last.id, this.modals.length)
    return true
  }
}

const instance = new ModalManagerService()
export default instance
