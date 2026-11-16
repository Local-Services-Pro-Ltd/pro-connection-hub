const RELOAD_STORAGE_KEY = "tradesmanfinder:stale-chunk-reload-at";
const RELOAD_WINDOW_MS = 30_000;

const DYNAMIC_IMPORT_ERROR =
  /failed to fetch dynamically imported module|error loading dynamically imported module|importing a module script failed|unable to preload css/i;

export function isDynamicImportError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return DYNAMIC_IMPORT_ERROR.test(message);
}

/** Reload once per 30 seconds; unavailable storage fails safe to the error page. */
export function reloadForStaleChunk(target: Window, now = Date.now()): boolean {
  try {
    const previous = Number(target.sessionStorage.getItem(RELOAD_STORAGE_KEY));
    if (Number.isFinite(previous) && previous !== 0 && now - previous < RELOAD_WINDOW_MS) {
      return false;
    }
    target.sessionStorage.setItem(RELOAD_STORAGE_KEY, String(now));
    target.location.reload();
    return true;
  } catch {
    return false;
  }
}

export function recoverFromDynamicImportError(error: unknown, target: Window): boolean {
  return isDynamicImportError(error) && reloadForStaleChunk(target);
}

/** Vite emits this before a failed preload reaches the router error boundary. */
export function installChunkErrorRecovery(target: Window): () => void {
  const onPreloadError = (event: Event) => {
    if (reloadForStaleChunk(target)) event.preventDefault();
  };
  target.addEventListener("vite:preloadError", onPreloadError);
  return () => target.removeEventListener("vite:preloadError", onPreloadError);
}
