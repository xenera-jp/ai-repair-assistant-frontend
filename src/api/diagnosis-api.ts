import { request } from './client'
import type { AnalysisStage, DiagnosisSession, OnsiteQuestionResponse, ProblemUnderstanding, RejectionRequest } from '../model'

/** 诊断会话生命周期及现场问答接口的前端适配层。 */
export const diagnosisApi = {
  understandProblem: (input: { stage: AnalysisStage; language: 'zh-CN' | 'ja-JP'; originalText: string }) =>
    request<ProblemUnderstanding>('/api/v1/problem-understandings', { method: 'POST', body: JSON.stringify(input) }),
  startDiagnosis: (input: { problemUnderstandingId: string; continueWithoutRecommendedFields: boolean }) =>
    request<DiagnosisSession>('/api/v1/diagnosis-sessions', { method: 'POST', body: JSON.stringify(input) }),
  getDiagnosis: (sessionId: string) => request<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}`, { method: 'GET' }),
  enterOnsite: (sessionId: string) => request<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}/onsite`, { method: 'POST' }),
  answerOnsiteQuestion: (sessionId: string, questionId: string, input: OnsiteQuestionResponse) =>
    request<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}/questions/${questionId}/responses`, { method: 'POST', body: JSON.stringify(input) }),
  rejectDiagnosis: (sessionId: string, input: RejectionRequest) =>
    request<ProblemUnderstanding>(`/api/v1/diagnosis-sessions/${sessionId}/rejections`, { method: 'POST', body: JSON.stringify(input) }),
  startOnsiteRediagnosis: (sessionId: string, input: { problemUnderstandingId: string; rejection: RejectionRequest }) =>
    request<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}/reanalysis`, { method: 'POST', body: JSON.stringify(input) }),
}
