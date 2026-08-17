/** PDF 原始页面坐标系中的证据高亮矩形。 */
export interface PdfSourceRegion {
  /** 高亮区域左上角的 X 坐标。 */
  x: number
  /** 高亮区域左上角的 Y 坐标。 */
  y: number
  /** 高亮区域宽度。 */
  width: number
  /** 高亮区域高度。 */
  height: number
  /** 原始 PDF 页面宽度，用于按比例换算显示位置。 */
  pageWidth: number
  /** 原始 PDF 页面高度，用于按比例换算显示位置。 */
  pageHeight: number
}

/** 证据在维修手册中的可定位来源。 */
export interface SourceDocumentLocation {
  /** 知识库中维修手册的数值 ID。 */
  manualKnowledgeId: number
  /** 手册文件名。 */
  fileName: string
  /** PDF 页码，通常从 1 开始。 */
  pdfPage: number
  /** 手册印刷页码；未记录时为 null。 */
  printedPage: string | null
  /** 文档章节路径；无法识别时为 null。 */
  sectionPath: string | null
  /** 命中的原文摘录。 */
  sourceQuote: string
  /** 后端用于定位原文的稳定锚点。 */
  sourceAnchor: string
  /** 原文所在页面的高亮区域；不可定位时为 null。 */
  sourceRegion: PdfSourceRegion | null
}

/** 支撑诊断结论的一条可追溯证据。 */
export interface EvidenceItem {
  /** 证据唯一标识，供候选与维修步骤引用。 */
  id: string
  /** 证据的简短标题。 */
  title: string
  /** 证据来源的文本引用。 */
  sourceReference: string
  /** 证据如何支撑诊断的摘要。 */
  summary: string
  /** 来源可信等级。 */
  trustLabel: 'AUTHORITATIVE' | 'VERIFIED_CASE' | 'OBSERVED_CASE' | 'USER_CONFIRMED'
  /** 该证据命中的故障信号编码。 */
  matchedSignals: string[]
  /** 可打开的手册定位信息；非文档类证据为 null。 */
  sourceDocument: SourceDocumentLocation | null
}

/** 按来源类型组织的证据集合，供结果页分组展示。 */
export interface EvidenceGroup {
  /** 证据来源类别，用于分组和图标展示。 */
  type: 'REPAIR_CASE' | 'SERVICE_MANUAL' | 'PART_REFERENCE' | 'ONSITE_OBSERVATION'
  /** 分组展示名称。 */
  label: string
  /** 该来源类别下的证据条目。 */
  items: EvidenceItem[]
}
