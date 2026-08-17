import { CircleAlert, Gauge, MessageSquareText, SkipForward } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../../i18n'
import type { DiagnosisSession, OnsiteQuestionResponse } from '../../model'

/** 根据问题类型收集现场选择、测量值或无法获取等回答。 */
export function OnsiteQuestionPanel({
  disabled,
  onAnswer,
  question,
}: {
  disabled: boolean
  onAnswer: (response: OnsiteQuestionResponse) => void
  question: NonNullable<DiagnosisSession['nextQuestion']>
}) {
  const { text } = useLanguage()
  const [measurement, setMeasurement] = useState('')
  const [otherText, setOtherText] = useState('')
  const [showOther, setShowOther] = useState(false)

  return (
    <section className="onsite-question">
      <div className="question-index">
        <span>{String(question.round).padStart(2, '0')}</span>
        <small>{text('最多 03 轮', '最大03ラウンド')}</small>
      </div>
      <div className="question-main">
        <span className="eyebrow">NEXT BEST QUESTION</span>
        <h2>{question.prompt}</h2>
        <p>
          {text(
            '该问题用于区分当前候选原因；回答会进入证据链并触发重新分析。',
            'この質問は原因候補を区別するためのものです。回答は証拠チェーンに追加され、再分析されます。',
          )}
        </p>

        {question.type === 'SINGLE_CHOICE' ? (
          <div className="question-options">
            {question.options.map((option) => (
              <button
                disabled={disabled}
                key={option.code}
                onClick={() =>
                  onAnswer({
                    responseType: 'OPTION',
                    selectedOptionCode: option.code,
                  })
                }
                type="button"
              >
                <span />
                {option.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="measurement-entry">
            <Gauge size={18} />
            <input
              aria-label={text('现场测量值', '現場測定値')}
              inputMode="decimal"
              placeholder={text('输入测量值', '測定値を入力')}
              type="number"
              value={measurement}
              onChange={(event) => setMeasurement(event.target.value)}
            />
            <span>{question.unit}</span>
            <button
              className="primary-button"
              disabled={disabled || !measurement}
              onClick={() =>
                onAnswer({
                  responseType: 'MEASUREMENT',
                  valueNumber: Number(measurement),
                  unit: question.unit ?? undefined,
                })
              }
              type="button"
            >
              {text('提交测量', '測定値を送信')}
            </button>
          </div>
        )}

        {showOther && (
          <div className="other-entry">
            <input
              aria-label={text('其他现场观察', 'その他の現場観察')}
              placeholder={text('输入现场实际观察', '現場での観察を入力')}
              value={otherText}
              onChange={(event) => setOtherText(event.target.value)}
            />
            <button
              className="secondary-button"
              disabled={disabled || !otherText.trim()}
              onClick={() =>
                onAnswer({
                  responseType: 'OTHER_TEXT',
                  rawText: otherText,
                })
              }
              type="button"
            >
              {text('提交观察', '観察内容を送信')}
            </button>
          </div>
        )}

        <div className="question-secondary-actions">
          <button
            aria-expanded={showOther}
            className="other-observation-button"
            disabled={disabled}
            onClick={() => setShowOther((current) => !current)}
            type="button"
          >
            <MessageSquareText size={17} />
            {text('其他观察', 'その他の観察')}
          </button>
          <button
            disabled={disabled}
            onClick={() => onAnswer({ responseType: 'UNAVAILABLE' })}
            type="button"
          >
            <CircleAlert size={14} />
            {text('无法确认', '確認できない')}
          </button>
          <button
            disabled={disabled}
            onClick={() => onAnswer({ responseType: 'SKIPPED' })}
            type="button"
          >
            <SkipForward size={14} />
            {text('暂时跳过', 'スキップ')}
          </button>
        </div>
      </div>
      <aside className="question-purpose">
        <span>{text('验证候选', '検証対象')}</span>
        <strong>
          {question.candidateCode
            .split('_')
            .map((part) => part.toLowerCase())
            .join(' ')}
        </strong>
        <small>{text('信号', 'シグナル')}：{question.signalCode}</small>
      </aside>
    </section>
  )
}
