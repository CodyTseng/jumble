export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

export function isEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
