import { request } from './client'
import type { SavedReport } from '../model'

/** 诊断报告的保存和查询接口。 */
export const reportApi = {
  saveReport: (sessionId: string, input: { reportName?: string; note?: string } = {}) =>
    request<SavedReport>(`/api/v1/diagnosis-sessions/${sessionId}/reports`, { method: 'POST', body: JSON.stringify(input) }),
  listReports: () => request<SavedReport[]>('/api/v1/reports', { method: 'GET' }),
  getReport: (reportId: string) => request<SavedReport>(`/api/v1/reports/${reportId}`, { method: 'GET' }),
}
