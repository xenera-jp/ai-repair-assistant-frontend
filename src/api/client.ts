import type {
  AnalysisStage,
  DiagnosisSession,
  OnsiteQuestionResponse,
  ProblemUnderstanding,
  SavedReport,
  SystemStatus,
} from './types'

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
    const errorPayload = await response.json().catch(() => null)
    const message =
      errorPayload?.detail ??
      errorPayload?.message ??
      `请求失败（HTTP ${response.status}）`
    throw new Error(message)
  }

  return response.json() as Promise<T>
}

export const api = {
  manualDocumentUrl: (manualKnowledgeId: number) =>
    `${apiBaseUrl}/api/v1/knowledge/manuals/${manualKnowledgeId}/document`,

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

  startDiagnosis: (input: {
    problemUnderstandingId: string
    continueWithoutRecommendedFields: boolean
  }) =>
    request<DiagnosisSession>('/api/v1/diagnosis-sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getDiagnosis: (sessionId: string) =>
    request<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}`, {
      method: 'GET',
    }),

  enterOnsite: (sessionId: string) =>
    request<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}/onsite`, {
      method: 'POST',
    }),

  answerOnsiteQuestion: (
    sessionId: string,
    questionId: string,
    input: OnsiteQuestionResponse,
  ) =>
    request<DiagnosisSession>(
      `/api/v1/diagnosis-sessions/${sessionId}/questions/${questionId}/responses`,
      {
        method: 'POST',
        body: JSON.stringify(input),
      },
    ),

  saveReport: (
    sessionId: string,
    input: { reportName?: string; note?: string } = {},
  ) =>
    request<SavedReport>(`/api/v1/diagnosis-sessions/${sessionId}/reports`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  listReports: () => request<SavedReport[]>('/api/v1/reports', { method: 'GET' }),

  getReport: (reportId: string) =>
    request<SavedReport>(`/api/v1/reports/${reportId}`, { method: 'GET' }),
}
