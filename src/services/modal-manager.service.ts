class ModalManagerService {
  static instance: ModalManagerService

  private modal?: { id: string; cb: () => void }
  private closeByUnregister = false

  constructor() {
    if (!ModalManagerService.instance) {
      ModalManagerService.instance = this
    }
    return ModalManagerService.instance
  }

  register(id: string, cb: () => void) {
    if (this.modal) {
      this.modal.cb()
    }
    this.modal = { id, cb }
    window.history.pushState(window.history.state, '', window.location.href)
  }

  unregister(id: string) {
    if (!this.modal || this.modal.id !== id) return

    this.modal.cb()
    this.modal = undefined
    this.closeByUnregister = true
    window.history.back()
  }

  pop() {
    if (this.closeByUnregister) {
      this.closeByUnregister = false
      return true
    }
    if (!this.modal) return false
    this.modal.cb()
    this.modal = undefined
    return true
  }
}

const instance = new ModalManagerService()
export default instance
