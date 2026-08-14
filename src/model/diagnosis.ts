import type { EvidenceGroup } from './evidence'
import type { ProblemUnderstanding } from './problem-understanding'

/** 诊断所处阶段：出发前初判或到达现场后的验证。 */
export type AnalysisStage = 'PRE_DEPARTURE' | 'ONSITE'

/** 单个故障原因候选及其证据支持程度。 */
export interface DiagnosisCandidate {
  /** 后端定义的候选原因编码，用于关联问题和证据。 */
  code: string
  /** 面向工程师展示的候选原因名称。 */
  label: string
  /** 候选排序，数值越小表示优先级越高。 */
  rank: number
  /** 证据汇总后的支持分数。 */
  supportScore: number
  /** 支持分数所属的离散区间，决定界面提示样式。 */
  supportBand: 'STRONG_SUPPORT' | 'SUPPORTED' | 'NEEDS_CONFIRMATION'
  /** 对该候选的可读解释。 */
  explanation: string
  /** 支持该候选的 EvidenceItem 标识集合。 */
  evidenceIds: string[]
}

/** 可执行的维修步骤；`evidenceIds` 用于追溯步骤依据。 */
export interface RepairStep {
  /** 步骤顺序，从 1 开始。 */
  sequence: number
  /** 维修人员需要执行的操作说明。 */
  instruction: string
  /** 该步骤的来源名称，例如维修手册章节。 */
  sourceLabel: string
  /** 支撑本步骤的 EvidenceItem 标识集合。 */
  evidenceIds: string[]
}

/** 现场诊断为区分候选原因而提出的问题。 */
export interface OnsiteQuestion {
  /** 本轮问题的唯一标识，提交回答时必须携带。 */
  id: string
  /** 回答控件类型：单选或数值测量。 */
  type: 'SINGLE_CHOICE' | 'MEASUREMENT'
  /** 展示给现场工程师的问题文案。 */
  prompt: string
  /** 该问题要验证的故障信号编码。 */
  signalCode: string
  /** 该问题主要服务的候选原因编码。 */
  candidateCode: string
  /** 现场问答轮次。 */
  round: number
  /** 测量题推荐的单位；非测量题为 null。 */
  unit: string | null
  /** 单选题可选项；测量题通常为空数组。 */
  options: Array<{
    /** 提交给后端的选项编码。 */ code: string
    /** 展示给工程师的选项文案。 */ label: string
  }>
}

/** 工程师对现场问题的结构化回答。 */
export interface OnsiteQuestionResponse {
  /** 回答形式，决定其余字段的解释方式。 */
  responseType: 'OPTION' | 'MEASUREMENT' | 'OTHER_TEXT' | 'UNAVAILABLE' | 'SKIPPED'
  /** 选择题中选中的选项编码。 */
  selectedOptionCode?: string
  /** 自由文本补充或无法测量的原因。 */
  rawText?: string
  /** 测量题采集到的数值。 */
  valueNumber?: number
  /** `valueNumber` 所使用的单位。 */
  unit?: string
}

/** 否定当前诊断时提交的现场观察描述。 */
export interface RejectionRequest {
  /** 与当前诊断不符的现场观察，作为重新分析的补充输入。 */
  onsiteObservation: string
}

/** 后端返回的完整诊断会话快照，是各诊断页面的核心数据模型。 */
export interface DiagnosisSession {
  /** 诊断会话唯一标识，也是后续 API 调用的主键。 */
  id: string
  /** 当前处于出发前或现场诊断阶段。 */
  stage: AnalysisStage
  /** 会话总体状态，反映证据充分性或现场收敛结果。 */
  status: 'READY' | 'PARTIALLY_SUPPORTED' | 'INSUFFICIENT_EVIDENCE' | 'ONSITE_QUESTIONING' | 'CONVERGED' | 'REJECTED'
  /** 分析进度，仅用于过程提示，不代表诊断置信度。 */
  progress: {
    /** 当前分析阶段的机器可读名称。 */ phase: string
    /** 当前阶段完成百分比，范围为 0 到 100。 */ percent: number
  }
  /** 本会话依据的问题理解快照。 */
  problemUnderstanding: ProblemUnderstanding
  /** 按优先级排序的故障原因候选列表。 */
  candidates: DiagnosisCandidate[]
  /** 供候选和维修建议追溯的分组证据。 */
  evidenceGroups: EvidenceGroup[]
  /** 基于当前候选生成的备件、工具和维修步骤建议。 */
  recommendations: {
    /** 建议携带或现场确认的备件列表。 */
    parts: Array<{
      /** 备件料号。 */ partNumber: string
      /** 备件名称。 */ name: string
      /** 出发前准备或到现场后确认。 */ preparationLevel: 'RECOMMENDED_PREPARE' | 'CONFIRM_ONSITE'
      /** 支撑该备件建议的证据标识。 */ evidenceIds: string[]
    }>
    /** 建议使用的工具列表。 */
    tools: Array<{ /** 工具编码。 */ code: string; /** 工具名称。 */ name: string }>
    /** 推荐的维修执行步骤。 */
    steps: RepairStep[]
  }
  /** 当前待回答的现场问题；无后续问题时为 null。 */
  nextQuestion: OnsiteQuestion | null
  /** 后端最后更新会话的 ISO 8601 时间。 */
  updatedAt: string
}
