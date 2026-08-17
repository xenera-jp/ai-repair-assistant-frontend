import { ArrowRight, TriangleAlert } from 'lucide-react'
import { useLanguage } from '../../i18n'
import type { ProblemUnderstanding } from '../../model'

/** 当关键推荐字段缺失时，请用户确认是否仍继续诊断。 */
export function RecommendedConfirm({
  fields,
  onCancel,
  onContinue,
}: {
  fields: ProblemUnderstanding['fields']
  onCancel: () => void
  onContinue: () => void
}) {
  const { text } = useLanguage()
  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        aria-labelledby="recommended-title"
        aria-modal="true"
        className="confirm-dialog"
        role="dialog"
      >
        <div className="dialog-icon warning">
          <TriangleAlert size={22} />
        </div>
        <span className="eyebrow">RECOMMENDED INFORMATION MISSING</span>
        <h2 id="recommended-title">
          {text('缺少强推荐信息', '推奨情報が不足しています')}
        </h2>
        <p>
          {text(
            '系统可以继续分析，但以下信息缺失会降低候选排序的区分度。',
            '分析は継続できますが、以下の情報がないと候補順位の精度が低下します。',
          )}
        </p>
        <ul>
          {fields.map((field) => (
            <li key={field.code}>{field.prompt || field.label}</li>
          ))}
        </ul>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            {text('返回补充', '入力に戻る')}
          </button>
          <button className="primary-button" onClick={onContinue} type="button">
            {text('仍然继续分析', 'このまま分析を続ける')}
            <ArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  )
}
