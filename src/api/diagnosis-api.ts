import { diagnosisRequest } from './model-cost-api'
import type { AnalysisStage, DiagnosisSession, OnsiteQuestionResponse, ProblemUnderstanding, RejectionRequest } from '../model'

/** 诊断会话生命周期及现场问答接口的前端适配层。 */
export const diagnosisApi = {
  understandProblem: (input: { stage: AnalysisStage; language: 'zh-CN' | 'ja-JP'; originalText: string }, costScope?: string) =>
    diagnosisRequest<ProblemUnderstanding>('/api/v1/problem-understandings', { method: 'POST', body: JSON.stringify(input) }, undefined, costScope),
  startDiagnosis: (input: { problemUnderstandingId: string; continueWithoutRecommendedFields: boolean }, costScope?: string) =>
    diagnosisRequest<DiagnosisSession>('/api/v1/diagnosis-sessions', { method: 'POST', body: JSON.stringify(input) }, input.problemUnderstandingId, costScope),
  getDiagnosis: (sessionId: string) => diagnosisRequest<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}`, { method: 'GET' }, sessionId),
  enterOnsite: (sessionId: string) => diagnosisRequest<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}/onsite`, { method: 'POST' }, sessionId),
  answerOnsiteQuestion: (sessionId: string, questionId: string, input: OnsiteQuestionResponse) =>
    diagnosisRequest<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}/questions/${questionId}/responses`, { method: 'POST', body: JSON.stringify(input) }, sessionId),
  rejectDiagnosis: (sessionId: string, input: RejectionRequest) =>
    diagnosisRequest<ProblemUnderstanding>(`/api/v1/diagnosis-sessions/${sessionId}/rejections`, { method: 'POST', body: JSON.stringify(input) }, sessionId),
  startOnsiteRediagnosis: (sessionId: string, input: { problemUnderstandingId: string; rejection: RejectionRequest }) =>
    diagnosisRequest<DiagnosisSession>(`/api/v1/diagnosis-sessions/${sessionId}/reanalysis`, { method: 'POST', body: JSON.stringify(input) }, sessionId),
}
