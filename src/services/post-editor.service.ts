class PostEditorService extends EventTarget {
  static instance: PostEditorService

  isSuggestionPopupOpen = false

  constructor() {
    super()
    if (!PostEditorService.instance) {
      PostEditorService.instance = this
    }
    return PostEditorService.instance
  }

  closeSuggestionPopup() {
    if (this.isSuggestionPopupOpen) {
      this.isSuggestionPopupOpen = false
      this.dispatchEvent(new CustomEvent('closeSuggestionPopup'))
    }
  }

  minimizeEditor(editorId: string) {
    this.dispatchEvent(new CustomEvent('minimizeEditor', { detail: { editorId } }))
  }
}

const instance = new PostEditorService()
export default instance
