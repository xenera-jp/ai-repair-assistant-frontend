/** Public paths include the gateway prefix; internal API paths stay unchanged. */
export function stripBase(path: string, base: string): string {
  const prefix = base.replace(/\/+$/, '')
  return prefix && (path === prefix || path.startsWith(`${prefix}/`))
    ? path.slice(prefix.length) || '/' : path
}

export function withBase(path: string, base: string): string {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(path)) return path
  return `${base.replace(/\/+$/, '')}/${stripBase(path, base).replace(/^\/+/, '')}`
}

export const appUrl = (path: string) => withBase(path, import.meta.env.BASE_URL)
export const routePath = (path: string) => stripBase(path, import.meta.env.BASE_URL)
export const resolveApiUrl = (path: string, base = import.meta.env.VITE_API_BASE_URL || import.meta.env.BASE_URL) => withBase(path, base)
