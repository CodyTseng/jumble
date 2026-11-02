// Compatibility exports for existing desktop consumers and snapshots.
export {
  NATIVE_STORAGE_REVISION_KEY as ELECTRON_STORAGE_REVISION_KEY,
  collectSafeLocalStorageEntries,
  shouldRestoreLocalStorage,
  restoreNativeLocalStorage as restoreElectronLocalStorage,
  startNativeLocalStorageBackup as startElectronLocalStorageBackup
} from './native-local-storage'
