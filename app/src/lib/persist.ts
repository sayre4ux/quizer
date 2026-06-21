// Ask the browser to keep our localStorage / cache from being evicted under
// storage pressure or inactivity. Supported on Chromium (Android/desktop) and
// on iOS/Safari 17+ (Storage API). On older iOS the method is absent and this
// is a no-op. Fire-and-forget, runs once at startup; iOS may only grant once
// the app is installed to the home screen, so we re-request until granted.
export async function requestPersistentStorage(): Promise<void> {
  try {
    if (!navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch {
    /* storage API unavailable — ignore */
  }
}
