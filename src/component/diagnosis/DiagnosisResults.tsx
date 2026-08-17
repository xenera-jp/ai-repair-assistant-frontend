import { ArrowRight, Check, CheckCircle2, ChevronRight, ClipboardCheck, ExternalLink, FileText, History, LoaderCircle, PackageCheck, Save, ShieldCheck, TriangleAlert, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '../../i18n'
import type { DiagnosisSession, EvidenceItem, RepairStep } from '../../model'
import { statusLabel, supportBandLabel } from '../../model/presentation'
import { StepSourcesDialog } from '../evidence/StepSourcesDialog'

/** 呈现候选故障、证据、备件和维修建议，并向上抛出后续操作。 */
export function DiagnosisResults({
  diagnosis,
  isSavingReport = false,
  onEnterOnsite,
  onOpenEvidence,
  onSaveReport,
  reportSaved = false,
}: {
  diagnosis: DiagnosisSession
  isSavingReport?: boolean
  onEnterOnsite?: () => void
  onOpenEvidence: (item: EvidenceItem) => void
  onSaveReport?: () => void
  reportSaved?: boolean
}) {
  const { language, text } = useLanguage()
  const [stepForSources, setStepForSources] = useState<RepairStep | null>(null)
  const [expandedEvidenceGroups, setExpandedEvidenceGroups] = useState<Set<string>>(
    () => new Set(),
  )
  const candidateCount = diagnosis.candidates.length
  const evidenceCount = diagnosis.evidenceGroups.reduce(
    (sum, group) => sum + group.items.length,
    0,
  )

  return (
    <section className="diagnosis-results" id="diagnosis-result">
      <header className="result-header">
        <div>
          <span className="eyebrow">DIAGNOSIS & EVIDENCE</span>
          <h2>{text('AI 诊断与决策建议', 'AI診断・判断支援')}</h2>
        </div>
        <div className="result-header-right">
          {(onEnterOnsite || onSaveReport) && (
            <div className="result-actions">
              {onSaveReport && (
                <button
                  className="secondary-button"
                  disabled={isSavingReport || reportSaved}
                  onClick={onSaveReport}
                  type="button"
                >
                  {isSavingReport ? (
                    <LoaderCircle className="spin" size={15} />
                  ) : reportSaved ? (
                    <Check size={15} />
                  ) : (
                    <Save size={15} />
                  )}
                  {reportSaved
                    ? text('报告已保存', '保存済み')
                    : text('保存报告', 'レポートを保存')}
                </button>
              )}
              {onEnterOnsite && (
                <button
                  className="primary-button"
                  onClick={onEnterOnsite}
                  type="button"
                >
                  {text('进入现场分析', '現場分析へ')}
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          )}
          <div className="result-stats">
            <span>
              <strong>{candidateCount}</strong>
              {text('候选原因', '原因候補')}
            </span>
            <span>
              <strong>{evidenceCount}</strong>
              {text('可追溯证据', '追跡可能な証拠')}
            </span>
            <span className={`status-${diagnosis.status.toLowerCase()}`}>
              <CheckCircle2 size={14} />
              {statusLabel(diagnosis.status, language)}
            </span>
          </div>
        </div>
      </header>

      <div className="diagnosis-evidence-grid">
        <section className="candidate-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">POSSIBLE CAUSES</span>
              <h3>{text('候选故障原因', '故障原因候補')}</h3>
            </div>
            <span>{text('最多显示 3 项', '最大3件')}</span>
          </div>

          {diagnosis.candidates.length ? (
            <div className="candidate-list">
              {diagnosis.candidates.map((candidate, index) => (
                <article
                  className={index === 0 ? 'candidate-card primary' : 'candidate-card'}
                  key={candidate.code}
                >
                  <span className="candidate-rank">
                    {String(candidate.rank).padStart(2, '0')}
                  </span>
                  <div className="candidate-copy">
                    <div>
                      {index === 0 && (
                        <span className="likely-tag">
                          {text('最可能原因', '最有力候補')}
                        </span>
                      )}
                      <h3>{candidate.label}</h3>
                    </div>
                    <p>{candidate.explanation}</p>
                    <div className="support-track">
                      <span
                        style={{ width: `${Math.min(candidate.supportScore, 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="candidate-score">
                    <small>{supportBandLabel(candidate.supportBand)}</small>
                    <strong>{Math.round(candidate.supportScore)}%</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="insufficient-evidence">
              <TriangleAlert size={24} />
              <strong>{text('当前证据不足', '現在の証拠は不十分です')}</strong>
              <p>
                {text(
                  '系统没有为了填满页面而生成低可信候选，请补充设备信息或现场现象。',
                  '低信頼の候補を補完表示していません。機器情報または現場症状を追加してください。',
                )}
              </p>
            </div>
          )}
        </section>

        <aside className="evidence-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">TRACEABLE EVIDENCE</span>
              <h3>{text('证据面板', '証拠パネル')}</h3>
            </div>
            <ShieldCheck size={19} />
          </div>
          <div className="evidence-groups">
            {diagnosis.evidenceGroups.map((group) => {
              const isExpanded = expandedEvidenceGroups.has(group.type)
              const visibleItems = isExpanded ? group.items : group.items.slice(0, 1)
              const hiddenItemCount = group.items.length - 1

              return (
              <div className="evidence-group" key={group.type}>
                <h4>
                  {group.type === 'REPAIR_CASE' ? (
                    <History size={15} />
                  ) : group.type === 'SERVICE_MANUAL' ? (
                    <FileText size={15} />
                  ) : group.type === 'ONSITE_OBSERVATION' ? (
                    <ClipboardCheck size={15} />
                  ) : (
                    <PackageCheck size={15} />
                  )}
                  {group.label}
                  <span>{group.items.length}</span>
                </h4>
                {visibleItems.map((item) => (
                  <button
                    className="evidence-item"
                    key={item.id}
                    onClick={() => onOpenEvidence(item)}
                    type="button"
                  >
                    <span className="trust-label">
                      {item.trustLabel === 'VERIFIED_CASE'
                        ? text('已验证案例', '検証済み事例')
                        : item.trustLabel === 'AUTHORITATIVE'
                          ? text('官方手册', '公式マニュアル')
                          : item.trustLabel === 'USER_CONFIRMED'
                            ? text('现场已确认', '現場確認済み')
                            : text('历史使用记录', '過去の使用記録')}
                    </span>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                    <span className="open-evidence">
                      {text('查看依据', '根拠を確認')}
                      <ExternalLink size={12} />
                    </span>
                  </button>
                ))}
                {hiddenItemCount > 0 && (
                  <button
                    aria-expanded={isExpanded}
                    className="evidence-group-expand"
                    onClick={() => {
                      setExpandedEvidenceGroups((current) => {
                        const next = new Set(current)
                        if (next.has(group.type)) next.delete(group.type)
                        else next.add(group.type)
                        return next
                      })
                    }}
                    type="button"
                  >
                    {isExpanded
                      ? text('收起其余证据', '残りの証拠を閉じる')
                      : text(
                          `展开其余 ${hiddenItemCount} 条证据`,
                          `残り ${hiddenItemCount} 件の証拠を表示`,
                        )}
                    <ChevronRight aria-hidden="true" size={14} />
                  </button>
                )}
              </div>
              )
            })}
          </div>
        </aside>
      </div>

      <section className="decision-panel">
        <div className="decision-title">
          <span className="eyebrow">PREPARATION & PROCEDURE</span>
          <h3>{text('备件、工具与维修步骤', '部品・工具・作業手順')}</h3>
        </div>
        <div className="decision-grid">
          <div className="preparation-column">
            <div className="preparation-block">
              <h4>
                <PackageCheck size={16} />
                {text('推荐备件', '推奨部品')}
              </h4>
              <div className="compact-items">
                {diagnosis.recommendations.parts.length ? (
                  diagnosis.recommendations.parts.map((part) => (
                    <div key={part.partNumber}>
                      <span>{part.name}</span>
                      <strong>{part.partNumber}</strong>
                      <small>
                        {part.preparationLevel === 'RECOMMENDED_PREPARE'
                          ? text('建议出发前准备', '出発前準備を推奨')
                          : text('现场确认后使用', '現場確認後に使用')}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="muted-copy">
                    {text(
                      '历史记录中暂无稳定备件证据。',
                      '過去の記録に安定した部品根拠がありません。',
                    )}
                  </p>
                )}
              </div>
            </div>
            <div className="preparation-block">
              <h4>
                <Wrench size={16} />
                {text('所需工具', '必要工具')}
              </h4>
              <div className="tool-tags">
                {diagnosis.recommendations.tools.map((tool) => (
                  <span key={tool.code}>{tool.name}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="steps-column">
            <h4>
              <ClipboardCheck size={16} />
              {text('建议维修步骤', '推奨作業手順')}
            </h4>
            {diagnosis.recommendations.steps.length ? (
              <ol className="repair-steps">
                {diagnosis.recommendations.steps.map((step) => (
                  <li key={`${step.sequence}-${step.instruction}`}>
                    <button
                      aria-label={`${text('查看步骤出处', '手順の出典を表示')}：${step.instruction}`}
                      className="repair-step-button"
                      disabled={step.evidenceIds.length === 0}
                      onClick={() => setStepForSources(step)}
                      type="button"
                    >
                    <span>{String(step.sequence).padStart(2, '0')}</span>
                    <div>
                      <strong>{step.instruction}</strong>
                      <small>
                        {step.sourceLabel === 'SERVICE_MANUAL' ||
                          step.sourceLabel === 'サービスマニュアル'
                          ? text('来自服务手册', 'サービスマニュアルに基づく')
                          : text('来自已解决维修案例', '解決済み修理事例に基づく')}
                      </small>
                    </div>
                    <ChevronRight aria-hidden="true" size={17} />
                    </button>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted-copy">
                {text(
                  '需要更多已验证处置记录后才能生成步骤。',
                  '手順生成には、さらに検証済みの処置記録が必要です。',
                )}
              </p>
            )}
          </div>
        </div>
      </section>
      {stepForSources && (
        <StepSourcesDialog
          evidenceGroups={diagnosis.evidenceGroups}
          onClose={() => setStepForSources(null)}
          onOpenEvidence={(item) => {
            setStepForSources(null)
            onOpenEvidence(item)
          }}
          step={stepForSources}
        />
      )}
    </section>
  )
}
