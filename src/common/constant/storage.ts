/** 浏览器存储键的唯一来源，避免跨页面出现不一致的字面量。 */
export const STORAGE_KEYS = {
  activeDiagnosisSessionId: 'activeDiagnosisSessionId',
  language: 'repair-assistant-language',
  theme: 'repair-assistant-theme',
  recordingWorkspace: 'repair-assistant-recording-workspace-v1',
  preDepartureWorkspace: 'repair-assistant-pre-departure-workspace-v1',
} as const
