// 允许部署环境通过 Vite 变量指定后端地址；本地开发时使用同源代理。
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

/** 统一处理 JSON 请求、错误负载和泛型响应反序列化。 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    const errorPayload = await response.json().catch(() => null)
    throw new Error(errorPayload?.detail ?? errorPayload?.message ?? `请求失败（HTTP ${response.status}）`)
  }
  return response.json() as Promise<T>
}

/** 构造非 fetch 场景（如 PDF iframe）的完整 API 地址。 */
export function apiUrl(path: string) { return `${apiBaseUrl}${path}` }
