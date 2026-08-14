import { STORAGE_KEYS } from '../constant/storage'

/** 当前标签页正在处理的诊断会话 ID，关闭标签页后自动失效。 */
export function getActiveDiagnosisSessionId() {
  return window.sessionStorage.getItem(STORAGE_KEYS.activeDiagnosisSessionId)
}

export function setActiveDiagnosisSessionId(sessionId: string) {
  window.sessionStorage.setItem(STORAGE_KEYS.activeDiagnosisSessionId, sessionId)
}

export function clearActiveDiagnosisSessionId() {
  window.sessionStorage.removeItem(STORAGE_KEYS.activeDiagnosisSessionId)
}
