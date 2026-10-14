/** Tab-scoped drafts survive reloads. Storage failures must not interrupt editing. */
export function readWorkspace<T>(key: string): T | null {
  try {
    const value = window.sessionStorage.getItem(key)
    return value ? JSON.parse(value) as T : null
  } catch {
    return null
  }
}

export function writeWorkspace(key: string, value: unknown) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Continue in memory when browser storage is unavailable or full.
  }
}
