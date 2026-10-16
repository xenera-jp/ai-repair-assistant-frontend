/** Client-side correlation ID; works on HTTP origins as well as HTTPS/localhost. */
export function createClientId(): string {
  const cryptoApi = globalThis.crypto
  if (typeof cryptoApi?.randomUUID === 'function') {
    try { return cryptoApi.randomUUID() } catch { /* Continue with random bytes if unavailable. */ }
  }
  const bytes = new Uint8Array(16)
  let filled = false
  if (typeof cryptoApi?.getRandomValues === 'function') {
    try { cryptoApi.getRandomValues(bytes); filled = true } catch { /* Restricted browser environment. */ }
  }
  if (!filled) {
    // This fallback is only for business correlation, never authentication or cryptographic keys.
    for (let index = 0; index < bytes.length; index++) bytes[index] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6]! & 0x0f) | 0x40
  bytes[8] = (bytes[8]! & 0x3f) | 0x80
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
