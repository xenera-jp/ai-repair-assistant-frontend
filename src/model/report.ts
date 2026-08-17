import type { AnalysisStage, DiagnosisSession } from './diagnosis'

/** 已持久化的诊断报告；`snapshot` 保留保存时的会话状态以便历史回看。 */
export interface SavedReport {
  /** 报告唯一标识，用于查询历史报告详情。 */
  id: string
  /** 生成该报告的诊断会话 ID。 */
  sessionId: string
  /** 用户填写或系统生成的报告名称。 */
  reportName: string
  /** 用户的补充备注；未填写时为 null。 */
  note: string | null
  /** 保存报告时诊断所处阶段。 */
  stage: AnalysisStage
  /** 保存时诊断会话的状态。 */
  diagnosisStatus: DiagnosisSession['status']
  /** 保存时排名第一的候选原因名称；无候选时为 null。 */
  topCandidate: string | null
  /** 报告保存时间，采用 ISO 8601 格式。 */
  savedAt: string
  /** 保存时的完整诊断会话快照，防止历史结果受后续变化影响。 */
  snapshot: DiagnosisSession
}
