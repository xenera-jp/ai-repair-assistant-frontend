import { RotateCcw, X } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../../i18n'
import type { RejectionRequest } from '../../model'

/** 收集现场观察，以否定当前结论并触发重新分析。 */
export function RejectionDialog({
  initialObservation,
  isSubmitting,
  onCancel,
  onSubmit,
  sessionTitle,
}: {
  initialObservation: string
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (request: RejectionRequest) => void
  sessionTitle: string
}) {
  const { text } = useLanguage()
  // Start from the original problem report; the submitted value remains the
  // user's edited onsite observation, so the existing workflow is unchanged.
  const [onsiteObservation, setOnsiteObservation] = useState(initialObservation)
  const invalid = !onsiteObservation.trim()

  return (
    <div className="dialog-backdrop rejection-backdrop" role="presentation">
      <section
        aria-labelledby="rejection-dialog-title"
        aria-modal="true"
        className="rejection-dialog"
        role="dialog"
      >
        <button aria-label={text('关闭', '閉じる')} className="dialog-close" onClick={onCancel} type="button">
          <X size={22} />
        </button>
        <header className="rejection-dialog-header">
          <span className="eyebrow">DIAGNOSIS CORRECTION</span>
          <h2 id="rejection-dialog-title">{text('重新描述现场问题', '現場の問題を再記述')}</h2>
          <p>{text('当前诊断会保留为历史记录。新描述将生成一条独立、可追溯的诊断会话。', '現在の診断は履歴として保存されます。新しい記述から、独立して追跡可能な診断セッションを作成します。')}</p>
        </header>
        <div className="rejection-dialog-body">
          <section className="rejection-session-summary">
            <span>{text('当前初步诊断', '現在の初期診断')}</span>
            <strong>{sessionTitle}</strong>
          </section>
          <label className="rejection-input">
            {text('现场问题描述', '現場の問題説明')}
            <textarea
              maxLength={4000}
              onChange={(event) => setOnsiteObservation(event.target.value)}
              value={onsiteObservation}
            />
            <small>{text('请写明设备型号、错误码（如有）、现场症状和运行状态。', '設備型式、エラーコード（ある場合）、現場の症状と運転状態を記入してください。')}</small>
          </label>
          <span className="rejection-character-count">{onsiteObservation.length} / 4000</span>
        </div>
        <footer className="dialog-actions rejection-dialog-actions">
          <button disabled={isSubmitting} onClick={onCancel} type="button">
            {text('保留当前诊断', '現在の診断を保持')}
          </button>
          <button
            className="primary-action"
            disabled={isSubmitting || invalid}
            onClick={() => onSubmit({ onsiteObservation: onsiteObservation.trim() })}
            type="button"
          >
            <RotateCcw size={18} />
            {isSubmitting ? text('正在重新分析…', '再分析中…') : text('重新分析', '再分析')}
          </button>
        </footer>
      </section>
    </div>
  )
}
