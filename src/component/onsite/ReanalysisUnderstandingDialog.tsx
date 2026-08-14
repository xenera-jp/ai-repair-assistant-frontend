import { X } from 'lucide-react'
import { useLanguage } from '../../i18n'
import type { ProblemUnderstanding } from '../../model'
import { UnderstandingPanel } from '../diagnosis/UnderstandingPanel'

/** 展示结合现场否定观察后重新提取的问题理解结果。 */
export function ReanalysisUnderstandingDialog({
  onCancel,
  onStart,
  understanding,
}: {
  onCancel: () => void
  onStart: () => void
  understanding: ProblemUnderstanding
}) {
  const { text } = useLanguage()
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-label={text('现场重分析的问题理解', '現場再分析の問題理解')}
        aria-modal="true"
        className="confirm-dialog reanalysis-understanding-dialog"
        role="dialog"
      >
        <button
          aria-label={text('关闭', '閉じる')}
          className="dialog-close"
          onClick={onCancel}
          type="button"
        >
          <X size={18} />
        </button>
        <UnderstandingPanel
          diagnosisReady={false}
          onStart={onStart}
          understanding={understanding}
        />
      </section>
    </div>
  )
}
