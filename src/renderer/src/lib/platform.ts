export function isMacOS() {
  return window.electron.process.platform === 'darwin'
}
