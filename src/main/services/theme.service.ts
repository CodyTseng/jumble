import { TThemeSetting } from '@common/types'
import { ipcMain, nativeTheme } from 'electron'
import { TSendToRenderer } from '../types'
import { StorageService } from './storage.service'

export class ThemeService {
  private themeSetting: TThemeSetting = 'system'

  constructor(
    private storageService: StorageService,
    private sendToRenderer: TSendToRenderer
  ) {}

  init() {
    this.themeSetting = this.storageService.getTheme()

    ipcMain.handle('theme:current', () => this.getCurrentTheme())
    ipcMain.handle('theme:themeSetting', () => this.themeSetting)
    ipcMain.handle('theme:set', (_, theme: TThemeSetting) => this.setTheme(theme))
    nativeTheme.on('updated', () => {
      if (this.themeSetting === 'system') {
        this.sendCurrentThemeToRenderer()
      }
    })
  }

  getCurrentTheme() {
    if (this.themeSetting === 'system') {
      return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
    }
    return this.themeSetting
  }

  private setTheme(theme: TThemeSetting) {
    this.themeSetting = theme
    this.storageService.setTheme(theme)
    this.sendCurrentThemeToRenderer()
  }

  private sendCurrentThemeToRenderer() {
    this.sendToRenderer('theme:change', this.getCurrentTheme())
  }
}
