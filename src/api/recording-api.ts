import { apiUrl, request } from './client'
import type { RecordingBatch, SpeakerRole } from '../model'

export const recordingApi = {
  createBatch: (file: File, language: string, signal?: AbortSignal) => {
    const body = new FormData()
    body.append('files', file, file.name)
    body.append('language', language)
    return request<RecordingBatch>('/api/v1/recording-batches', { method: 'POST', body, signal })
  },
  getBatch: (id: string) => request<RecordingBatch>(`/api/v1/recording-batches/${id}`),
  transcriptionStreamUrl: (id: string) => apiUrl(`/api/v1/recording-batches/${id}/transcription-stream`),
  retryFile: (id: string) => request<RecordingBatch>(`/api/v1/recording-files/${id}/transcription-retries`, { method: 'POST' }),
  retryExtraction: (id: string) => request<RecordingBatch>(`/api/v1/recording-batches/${id}/issue-extractions`, { method: 'POST' }),
  setSpeakerRole: (fileId: string, speaker: string, roleCode: SpeakerRole) => request<RecordingBatch>(`/api/v1/recording-files/${fileId}/speakers/${encodeURIComponent(speaker)}/role`, { method: 'PUT', body: JSON.stringify({ roleCode }) }),
  createIssue: (batchId: string, type: string, content: string) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues`, { method: 'POST', body: JSON.stringify({ type, content }) }),
  updateIssue: (batchId: string, issueId: string, content: string, version: number) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues/${issueId}`, { method: 'PATCH', body: JSON.stringify({ content, version }) }),
  deleteIssue: (batchId: string, issueId: string) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues/${issueId}`, { method: 'DELETE' }),
  restoreIssue: (batchId: string, issueId: string) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues/${issueId}/restore`, { method: 'POST' }),
  confirmCorrections: (batchId: string, decisions: { issueId: string; version: number; decision: 'ACCEPT' | 'KEEP_ORIGINAL' | 'MANUAL_VALUE'; value?: string }[]) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/identifier-corrections/confirm`, { method: 'POST', body: JSON.stringify({ decisions }) }),
  audioUrl: (id: string) => apiUrl(`/api/v1/recording-files/${id}/content`),
  deleteFile: (id: string) => request<void>(`/api/v1/recording-files/${id}`, { method: 'DELETE' }),
}
