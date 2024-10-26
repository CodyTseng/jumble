import { ipcMain, nativeTheme } from 'electron'
import { TSendToRenderer } from '../types'

export class ThemeService {
  constructor(private sendToRenderer: TSendToRenderer) {}

  init() {
    ipcMain.handle('theme:current', () => this.getCurrentTheme())
    nativeTheme.on('updated', () => {
      this.sendCurrentThemeToRenderer()
    })
  }

  getCurrentTheme() {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  }

  private sendCurrentThemeToRenderer() {
    this.sendToRenderer('theme:change', this.getCurrentTheme())
  }
}
