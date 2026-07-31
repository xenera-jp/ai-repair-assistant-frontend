import type { AnalysisStage, ProblemUnderstanding, SystemStatus } from './types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
}

export const api = {
  getSystemStatus: () =>
    request<SystemStatus>('/api/v1/system/status', { method: 'GET' }),

  understandProblem: (input: {
    stage: AnalysisStage
    language: 'zh-CN' | 'ja-JP'
    originalText: string
  }) =>
    request<ProblemUnderstanding>('/api/v1/problem-understandings', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
}
