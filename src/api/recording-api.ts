import { apiUrl, request } from './client'
import type { RecordingApplication, RecordingBatch, SpeakerRole } from '../model'

export const recordingApi = {
  createBatch: (files: File[], language: string) => {
    const body = new FormData()
    files.forEach((file) => body.append('files', file, file.name))
    body.append('language', language)
    return request<RecordingBatch>('/api/v1/recording-batches', { method: 'POST', body })
  },
  getBatch: (id: string) => request<RecordingBatch>(`/api/v1/recording-batches/${id}`),
  retryFile: (id: string) => request<RecordingBatch>(`/api/v1/recording-files/${id}/transcription-retries`, { method: 'POST' }),
  retryExtraction: (id: string) => request<RecordingBatch>(`/api/v1/recording-batches/${id}/issue-extractions`, { method: 'POST' }),
  setSpeakerRole: (fileId: string, speaker: string, roleCode: SpeakerRole) => request<RecordingBatch>(`/api/v1/recording-files/${fileId}/speakers/${encodeURIComponent(speaker)}/role`, { method: 'PUT', body: JSON.stringify({ roleCode }) }),
  createIssue: (batchId: string, type: string, content: string) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues`, { method: 'POST', body: JSON.stringify({ type, content }) }),
  updateIssue: (batchId: string, issueId: string, content: string, version: number) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues/${issueId}`, { method: 'PATCH', body: JSON.stringify({ content, version }) }),
  deleteIssue: (batchId: string, issueId: string) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues/${issueId}`, { method: 'DELETE' }),
  restoreIssue: (batchId: string, issueId: string) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues/${issueId}/restore`, { method: 'POST' }),
  confirmCorrections: (batchId: string, decisions: { issueId: string; version: number; decision: 'ACCEPT' | 'KEEP_ORIGINAL' | 'MANUAL_VALUE'; value?: string }[]) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/identifier-corrections/confirm`, { method: 'POST', body: JSON.stringify({ decisions }) }),
  createApplication: (batchId: string) => request<RecordingApplication>(`/api/v1/recording-batches/${batchId}/applications`, { method: 'POST' }),
  getApplication: (id: string) => request<RecordingApplication>(`/api/v1/recording-applications/${id}`),
  consumeApplication: (id: string) => request<RecordingApplication>(`/api/v1/recording-applications/${id}/consume`, { method: 'POST' }),
  attachUnderstanding: (id: string, understandingId: string) => request<void>(`/api/v1/recording-applications/${id}/problem-understanding`, { method: 'PUT', body: JSON.stringify({ id: understandingId }) }),
  attachDiagnosis: (id: string, diagnosisId: string) => request<void>(`/api/v1/recording-applications/${id}/diagnosis-session`, { method: 'PUT', body: JSON.stringify({ id: diagnosisId }) }),
  audioUrl: (id: string) => apiUrl(`/api/v1/recording-files/${id}/content`),
}
