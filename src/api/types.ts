export type AnalysisStage = 'PRE_DEPARTURE' | 'ONSITE'

export type FieldLevel = 'A' | 'B' | 'C'

export type FieldState =
  | 'EXTRACTED'
  | 'CONFIRMED'
  | 'MISSING'
  | 'NOT_APPLICABLE'

export interface UnderstoodField {
  code: string
  label: string
  value: string | number | boolean | null
  unit: string | null
  sourceText: string | null
  level: FieldLevel
  state: FieldState
  confidence: number
  prompt: string | null
}

export interface ProblemUnderstanding {
  id: string
  originalText: string
  language: 'zh-CN' | 'ja-JP'
  summary: string
  primaryProblemType: {
    code: string
    label: string
    supportScore: number
  }
  fields: UnderstoodField[]
  readyForAnalysis: boolean
  blockingMessage: string | null
}

export interface SystemStatus {
  service: string
  status: 'UP'
  knowledgeVersion: string
  integrations: {
    qdrantConfigured: boolean
    openAiConfigured: boolean
  }
  timestamp: string
}

export interface DiagnosisCandidate {
  code: string
  label: string
  rank: number
  supportScore: number
  supportBand: 'STRONG_SUPPORT' | 'SUPPORTED' | 'NEEDS_CONFIRMATION'
  explanation: string
  evidenceIds: string[]
}

export interface EvidenceItem {
  id: string
  title: string
  sourceReference: string
  summary: string
  trustLabel:
    | 'AUTHORITATIVE'
    | 'VERIFIED_CASE'
    | 'OBSERVED_CASE'
    | 'USER_CONFIRMED'
  matchedSignals: string[]
  sourceDocument: SourceDocumentLocation | null
}

export interface SourceDocumentLocation {
  manualKnowledgeId: number
  fileName: string
  pdfPage: number
  printedPage: string | null
  sectionPath: string | null
  sourceQuote: string
  sourceAnchor: string
  sourceRegion: PdfSourceRegion | null
}

export interface PdfSourceRegion {
  x: number
  y: number
  width: number
  height: number
  pageWidth: number
  pageHeight: number
}

export interface EvidenceGroup {
  type:
    | 'REPAIR_CASE'
    | 'SERVICE_MANUAL'
    | 'PART_REFERENCE'
    | 'ONSITE_OBSERVATION'
  label: string
  items: EvidenceItem[]
}

export interface DiagnosisSession {
  id: string
  stage: AnalysisStage
  status:
    | 'READY'
    | 'PARTIALLY_SUPPORTED'
    | 'INSUFFICIENT_EVIDENCE'
    | 'ONSITE_QUESTIONING'
    | 'CONVERGED'
  progress: {
    phase: string
    percent: number
  }
  problemUnderstanding: ProblemUnderstanding
  candidates: DiagnosisCandidate[]
  evidenceGroups: EvidenceGroup[]
  recommendations: {
    parts: Array<{
      partNumber: string
      name: string
      preparationLevel: 'RECOMMENDED_PREPARE' | 'CONFIRM_ONSITE'
      evidenceIds: string[]
    }>
    tools: Array<{
      code: string
      name: string
    }>
    steps: Array<{
      sequence: number
      instruction: string
      sourceLabel: string
      evidenceIds: string[]
    }>
  }
  nextQuestion: OnsiteQuestion | null
  updatedAt: string
}

export interface OnsiteQuestion {
  id: string
  type: 'SINGLE_CHOICE' | 'MEASUREMENT'
  prompt: string
  signalCode: string
  candidateCode: string
  round: number
  unit: string | null
  options: Array<{
    code: string
    label: string
  }>
}

export interface OnsiteQuestionResponse {
  responseType:
    | 'OPTION'
    | 'MEASUREMENT'
    | 'OTHER_TEXT'
    | 'UNAVAILABLE'
    | 'SKIPPED'
  selectedOptionCode?: string
  rawText?: string
  valueNumber?: number
  unit?: string
}

export interface SavedReport {
  id: string
  sessionId: string
  reportName: string
  note: string | null
  stage: AnalysisStage
  diagnosisStatus: DiagnosisSession['status']
  topCandidate: string | null
  savedAt: string
  snapshot: DiagnosisSession
}
