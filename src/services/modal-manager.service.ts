class ModalManagerService {
  static instance: ModalManagerService

  private stack: { id: string; cb: () => void }[] = []

  constructor() {
    if (!ModalManagerService.instance) {
      ModalManagerService.instance = this
    }
    return ModalManagerService.instance
  }

  register(id: string, cb: () => void) {
    this.stack.push({ id, cb })
    console.debug('register modal', id, this.stack.length)
  }

  unregister(id: string) {
    const last = this.stack.pop()
    if (!last) return
    if (last.id !== id) {
      this.stack.push(last)
      return
    }
    last.cb()
    console.debug('unregister modal', id, this.stack.length)
  }

  pop() {
    const last = this.stack.pop()
    if (!last) return false
    last.cb()
    console.debug('pop modal', last.id, this.stack.length)
    return true
  }
}

const instance = new ModalManagerService()
export default instance
