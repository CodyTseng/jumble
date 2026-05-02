import { app, BrowserWindow, Rectangle, screen } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

const STATE_FILE = 'window-state.json'
const SAVE_DEBOUNCE_MS = 500

const DEFAULTS = {
  width: 1024,
  height: 820
}

export type TWindowState = {
  x?: number
  y?: number
  width: number
  height: number
  isMaximized?: boolean
}

function statePath(): string {
  return path.join(app.getPath('userData'), STATE_FILE)
}

function intersects(a: Rectangle, b: Rectangle): boolean {
  return !(
    b.x + b.width <= a.x ||
    b.x >= a.x + a.width ||
    b.y + b.height <= a.y ||
    b.y >= a.y + a.height
  )
}

function ensureVisible(state: TWindowState): TWindowState {
  if (state.x === undefined || state.y === undefined) return state
  const bounds: Rectangle = {
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height
  }
  const visible = screen.getAllDisplays().some((d) => intersects(d.workArea, bounds))
  if (!visible) {
    return { width: state.width, height: state.height, isMaximized: state.isMaximized }
  }
  return state
}

export function loadWindowState(): TWindowState {
  try {
    const raw = fs.readFileSync(statePath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<TWindowState>
    return ensureVisible({ ...DEFAULTS, ...parsed })
  } catch {
    return { ...DEFAULTS }
  }
}

export function attachWindowStatePersistence(win: BrowserWindow) {
  let saveTimer: NodeJS.Timeout | null = null

  const save = () => {
    if (win.isDestroyed()) return
    const isMaximized = win.isMaximized()
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds()
    const state: TWindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized
    }
    try {
      fs.writeFileSync(statePath(), JSON.stringify(state))
    } catch {
      // ignore — best-effort persistence
    }
  }

  const queueSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(save, SAVE_DEBOUNCE_MS)
  }

  win.on('resize', queueSave)
  win.on('move', queueSave)
  win.on('close', () => {
    if (saveTimer) clearTimeout(saveTimer)
    save()
  })
}
