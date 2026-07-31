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
