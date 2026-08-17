/** 字段对诊断的重要等级，A 级通常是继续分析所需的关键输入。 */
export type FieldLevel = 'A' | 'B' | 'C'

/** 从报障原文中提取字段后的可用状态。 */
export type FieldState =
  | 'EXTRACTED'
  | 'CONFIRMED'
  | 'MISSING'
  | 'NOT_APPLICABLE'
  // Backward compatibility for snapshots produced before unknown LLM fields
  // were kept as MISSING. The UI renders this legacy state as not supplied.
  | 'NOT_REQUIRED'

/** 对报障文本解析出的单个结构化字段。 */
export interface UnderstoodField {
  /** 稳定字段编码，例如设备型号或报警代码。 */
  code: string
  /** 当前语言下展示给用户的字段名称。 */
  label: string
  /** 从原文提取或由用户确认的字段值；缺失时为 null。 */
  value: string | number | boolean | null
  /** 数值字段的计量单位；无单位时为 null。 */
  unit: string | null
  /** 支撑该字段值的报障原文片段；无来源时为 null。 */
  sourceText: string | null
  /** 该字段对诊断完整性的优先级。 */
  level: FieldLevel
  /** 当前字段是否已提取、确认、缺失或不适用。 */
  state: FieldState
  /** 提取结果的置信度，通常为 0 到 1。 */
  confidence: number
  /** 字段缺失时用于引导补充的信息提示；无需补充时为 null。 */
  prompt: string | null
}

/** 问题理解结果：诊断开始前的结构化输入与完整性判断。 */
export interface ProblemUnderstanding {
  /** 问题理解结果唯一标识，创建诊断会话时引用。 */
  id: string
  /** 用户输入的原始报障文本。 */
  originalText: string
  /** 原始文本和返回文案所使用的语言。 */
  language: 'zh-CN' | 'ja-JP'
  /** 对报障现象的简短结构化摘要。 */
  summary: string
  /** 系统判定的主问题类型及其支持分数。 */
  primaryProblemType: {
    /** 问题类型的稳定分类编码。 */ code: string
    /** 问题类型展示名称。 */ label: string
    /** 分类匹配支持分数。 */ supportScore: number
  }
  /** 从报障文本中识别出的全部字段。 */
  fields: UnderstoodField[]
  /** 关键字段已满足分析要求时为 true。 */
  readyForAnalysis: boolean
  /** 阻止继续分析的原因；可分析时为 null。 */
  blockingMessage: string | null
}
