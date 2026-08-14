import { Check, CheckCircle2, CircleAlert, ShieldCheck } from 'lucide-react'
import { useLanguage } from '../../i18n'
import type { ProblemUnderstanding } from '../../model'

/** 展示报障文本的结构化理解结果及字段完整性。 */
export function UnderstandingPanel({
  diagnosisReady,
  onStart,
  understanding,
}: {
  diagnosisReady: boolean
  onStart: () => void
  understanding: ProblemUnderstanding
}) {
  const { text } = useLanguage()
  const recommendedMissing = understanding.fields.filter(
    (field) => field.level === 'B' && (field.state === 'MISSING' || field.state === 'NOT_REQUIRED'),
  )
  const requiredMissing = understanding.fields.filter(
    (field) => field.level === 'A' && (field.state === 'MISSING' || field.state === 'NOT_REQUIRED'),
  )

  return (
    <section className="understanding-layout">
      <div className="understanding-main">
        <div className="section-title">
          <Check size={19} />
          <div>
            <h2>{text('问题理解', '問題理解')}</h2>
            <p>{understanding.summary}</p>
          </div>
        </div>

        <div className="field-grid">
          {understanding.fields.map((field) => (
            <div
              className={`understood-field level-${field.level.toLowerCase()} ${(field.state === 'MISSING' || field.state === 'NOT_REQUIRED') ? 'is-missing' : ''
                }`}
              key={field.code}
            >
              <span className="field-label">
                {field.label}
                <small>{field.level}</small>
              </span>
              <strong>
                {(field.state === 'NOT_REQUIRED' ? '' : field.value?.toString()) || text('尚未补充', '未入力')}
              </strong>
              <span className="field-meta">
                {field.state === 'MISSING' || field.state === 'NOT_REQUIRED'
                  ? field.prompt
                  : `${text('识别可信度', '抽出信頼度')} ${Math.round(field.confidence * 100)}%`}
              </span>
            </div>
          ))}
        </div>
      </div>

      <aside className="analysis-readiness">
        <span className="eyebrow">PROBLEM CLASSIFICATION</span>
        <h2>{understanding.primaryProblemType.label}</h2>
        <div className="support-score">
          <strong>{Math.round(understanding.primaryProblemType.supportScore)}</strong>
          <span>{text('问题分类支持度', '問題分類の支持度')}</span>
        </div>

        {requiredMissing.length > 0 && (
          <div className="blocking-notice">
            <CircleAlert size={17} />
            <p>{understanding.blockingMessage}</p>
          </div>
        )}

        {recommendedMissing.length > 0 && (
          <div className="strong-notice">
            <CircleAlert size={17} />
            <p>
              {text('强烈建议补充：', '追加入力を強く推奨：')}
              {recommendedMissing.map((field) => field.prompt).join(' ')}
            </p>
          </div>
        )}

        <button
          className="primary-button wide"
          disabled={!understanding.readyForAnalysis || diagnosisReady}
          onClick={onStart}
          type="button"
        >
          {diagnosisReady ? <CheckCircle2 size={17} /> : <ShieldCheck size={17} />}
          {diagnosisReady
            ? text('诊断已完成', '診断完了')
            : text('进入AI诊断', 'AI診断へ進む')}
        </button>
      </aside>
    </section>
  )
}
