import { request } from './client'
import { readWorkspace, writeWorkspace } from '../common/storage/workspace-storage'

export interface ModelCostEntry {
  id: number; category: string; model: string; inputTokens: number | null; cachedTokens: number | null
  audioTokens: number | null; outputTokens: number | null; audioSeconds: number | null
  costUsd: number | null; status: string; basis: string; pricingJson: string; createdAt: string
}
export interface ModelCostSummary {
  totalUsd: number; withoutSpeakerProcessingUsd: number; diarizationUsd: number; roleRecognitionUsd: number
  unpricedCalls: number; estimatedCalls: number; calls: ModelCostEntry[]
}
const links: Record<string, string> = readWorkspace<Record<string, string>>('model-cost-links-v1') ?? {}
export function modelCostScope(id?: string | null) { return id ? links[id] : undefined }
export async function diagnosisRequest<T>(path: string, init: RequestInit, relatedId?: string, scope?: string): Promise<T> {
  const selectedScope = scope ?? modelCostScope(relatedId)
  const headers = new Headers(init.headers)
  if (selectedScope) headers.set('X-Model-Cost-Scope', selectedScope)
  const result = await request<T>(path, { ...init, headers })
  const id = (result as { id?: string } | null)?.id
  if (selectedScope && id) { links[id] = selectedScope; writeWorkspace('model-cost-links-v1', links) }
  return result
}
export const getModelCosts = (scope: string, signal?: AbortSignal) => request<ModelCostSummary>(`/api/v1/model-costs/${encodeURIComponent(scope)}`, { signal })

export interface ModelCostHistoryEntry { id: string; scopeKey: string; functionCode: string; createdAt: string; costUsd: number | null; status: string }
export const getModelCostHistory = (signal?: AbortSignal) => request<ModelCostHistoryEntry[]>('/api/v1/model-costs/history', { signal })
