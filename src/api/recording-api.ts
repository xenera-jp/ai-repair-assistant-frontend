import { apiUrl, request } from './client'
import type { RecordingBatch, SpeakerRole } from '../model'

export const recordingApi = {
  createBatch: (file: File, language: string, signal?: AbortSignal) => {
    const body = new FormData()
    body.append('files', file, file.name)
    body.append('language', language)
    body.append('realtime', 'true')
    return request<RecordingBatch>('/api/v1/recording-batches', { method: 'POST', body, signal })
  },
  getBatch: (id: string) => request<RecordingBatch>(`/api/v1/recording-batches/${id}`),
  startRealtime: (fileId: string) => request<{ sessionId: string; batch: RecordingBatch }>(`/api/v1/recording-files/${fileId}/realtime-sessions`, { method: 'POST', signal: AbortSignal.timeout(45000) }),
  realtimeFrame: (id: string, startSample: number, audio: string) => request<{ nextSample: number }>(`/api/v1/recording-realtime-sessions/${id}/frames`, { method: 'POST', body: JSON.stringify({ startSample, audio }), signal: AbortSignal.timeout(15000) }),
  finishRealtime: (id: string) => request<RecordingBatch>(`/api/v1/recording-realtime-sessions/${id}/finish`, { method: 'POST', signal: AbortSignal.timeout(15000) }),
  cancelRealtime: (id: string) => request<void>(`/api/v1/recording-realtime-sessions/${id}`, { method: 'DELETE', keepalive: true }),
  transcriptionStreamUrl: (id: string) => apiUrl(`/api/v1/recording-batches/${id}/transcription-stream`),
  retryDiarization: (id: string) => request<RecordingBatch>(`/api/v1/recording-files/${id}/diarization-retries`, { method: 'POST' }),
  retryFile: (id: string) => request<RecordingBatch>(`/api/v1/recording-files/${id}/transcription-retries`, { method: 'POST' }),
  retryExtraction: (id: string, conversationVersion: string) => request<RecordingBatch>(`/api/v1/recording-batches/${id}/issue-extractions`, { method: 'POST', body: JSON.stringify({ conversationVersion }) }),
  setSpeakerRole: (fileId: string, speaker: string, roleCode: SpeakerRole) => request<RecordingBatch>(`/api/v1/recording-files/${fileId}/speakers/${encodeURIComponent(speaker)}/role`, { method: 'PUT', body: JSON.stringify({ roleCode }) }),
  setSegmentSpeaker: (fileId: string, segmentId: string, speakerLabel: string, segmentIds?: string[]) => request<RecordingBatch>(`/api/v1/recording-files/${fileId}/segments/${segmentId}/speaker`, { method: 'PUT', body: JSON.stringify({ speakerLabel, segmentIds }) }),
  createIssue: (batchId: string, type: string, content: string) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues`, { method: 'POST', body: JSON.stringify({ type, content }) }),
  updateIssue: (batchId: string, issueId: string, content: string, version: number) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues/${issueId}`, { method: 'PATCH', body: JSON.stringify({ content, version }) }),
  deleteIssue: (batchId: string, issueId: string) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues/${issueId}`, { method: 'DELETE' }),
  restoreIssue: (batchId: string, issueId: string) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/extracted-issues/${issueId}/restore`, { method: 'POST' }),
  confirmCorrections: (batchId: string, decisions: { issueId: string; version: number; decision: 'ACCEPT' | 'KEEP_ORIGINAL' | 'MANUAL_VALUE'; value?: string }[]) => request<RecordingBatch>(`/api/v1/recording-batches/${batchId}/identifier-corrections/confirm`, { method: 'POST', body: JSON.stringify({ decisions }) }),
  audioUrl: (id: string) => apiUrl(`/api/v1/recording-files/${id}/content`),
  deleteFile: (id: string) => request<void>(`/api/v1/recording-files/${id}`, { method: 'DELETE' }),
}
