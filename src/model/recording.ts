export type RecordingStatus = 'UPLOADING' | 'TRANSCRIBING' | 'PARTIAL_SUCCESS' | 'TRANSCRIBED' | 'EXTRACTING' | 'REVIEW_REQUIRED' | 'READY' | 'EXTRACTION_FAILED' | 'FAILED'
export type SpeakerRole = 'CUSTOMER_SERVICE' | 'CUSTOMER' | 'FIELD_ENGINEER' | 'OTHER' | 'UNKNOWN'

export interface TranscriptSegment { id: string; sequenceNo: number; speakerLabel: string; roleCode: SpeakerRole | null; roleConfidence: number | null; roleSource: 'MODEL' | 'MANUAL' | 'NONE'; startMs: number; endMs: number; text: string }
export interface RecordingFile { id: string; name: string; contentType: string; sizeBytes: number; status: string; errorCode: string | null; errorMessage: string | null; segments: TranscriptSegment[] }
export interface RecordingEvidence { fileId: string; fileName: string; segmentId: string; speakerLabel: string; roleCode: SpeakerRole | null; startMs: number; endMs: number; text: string }
export interface IdentifierCorrection { status: 'NO_DICTIONARY' | 'RULE_AUTO_CORRECTED' | 'LLM_PENDING_CONFIRMATION' | 'MANUAL_INPUT_REQUIRED' | 'USER_ACCEPTED_LLM' | 'USER_REJECTED_LLM' | 'UNRESOLVED' | 'MANUAL_EDIT'; originalValue: string; suggestedValue: string | null; model: string | null; sourceText: string | null; ruleScore: number | null; reason: string | null; evidenceSegmentIds: string[] }
export interface ExtractedIssue { id: string; type: string; content: string; originalContent: string; editedByUser: boolean; deleted: boolean; version: number; evidence: RecordingEvidence[]; correction: IdentifierCorrection | null }
export interface RecordingBatch { id: string; language: string; status: RecordingStatus; extractionRevision: number; extractionError: string | null; files: RecordingFile[]; issues: ExtractedIssue[]; createdAt: string }
export interface RecordingApplication { id: string; composedText: string; status: string; problemUnderstandingId: string | null; diagnosisSessionId: string | null; consumed: boolean }
