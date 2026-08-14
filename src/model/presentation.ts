import type { DiagnosisSession } from './diagnosis'

/** 将后端状态枚举转换为当前界面语言的展示文案。 */
export function statusLabel(status: DiagnosisSession['status'], language: 'zh-CN' | 'ja-JP') {
  const japanese = language === 'ja-JP'
  if (status === 'READY') return japanese ? '証拠十分' : '证据充分'
  if (status === 'ONSITE_QUESTIONING') return japanese ? '現場確認待ち' : '等待现场确认'
  if (status === 'CONVERGED') return japanese ? '現場結論が収束' : '现场结论已收敛'
  if (status === 'PARTIALLY_SUPPORTED') return japanese ? '一部支持' : '部分支持'
  if (status === 'REJECTED') return japanese ? '否定済み' : '已否定'
  return japanese ? '証拠不足' : '证据不足'
}

/** 从会话的问题理解结果中安全读取字段，并提供缺省显示值。 */
export function fieldValue(diagnosis: DiagnosisSession, code: string, language: 'zh-CN' | 'ja-JP') {
  return diagnosis.problemUnderstanding.fields.find((field) => field.code === code)?.value?.toString()
    || (language === 'ja-JP' ? '機器不明' : '未知设备')
}

/** 将候选支持度映射为 UI 使用的三级标签。 */
export function supportBandLabel(supportBand: DiagnosisSession['candidates'][number]['supportBand']) {
  if (supportBand === 'STRONG_SUPPORT') return 'HIGH'
  if (supportBand === 'SUPPORTED') return 'MEDIUM'
  return 'REVIEW'
}
