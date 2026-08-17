import { ChevronRight, X } from 'lucide-react'
import { useLanguage } from '../../i18n'
import type { EvidenceGroup, EvidenceItem, RepairStep } from '../../model'

/** 显示某个维修步骤所引用的来源证据。 */
export function StepSourcesDialog({
  step,
  evidenceGroups,
  onOpenEvidence,
  onClose,
}: {
  step: RepairStep
  evidenceGroups: EvidenceGroup[]
  onOpenEvidence: (item: EvidenceItem) => void
  onClose: () => void
}) {
  const { text } = useLanguage()
  const sources = evidenceGroups.flatMap((group) =>
    group.items
      .filter((item) => step.evidenceIds.includes(item.id))
      .map((item) => ({ item, sourceLabel: group.label })),
  )

  return (
    <div className="dialog-backdrop step-sources-backdrop" role="presentation">
      <section
        aria-labelledby="step-sources-title"
        aria-modal="true"
        className="step-sources-dialog"
        role="dialog"
      >
        <header>
          <div>
            <span className="eyebrow">STEP SOURCES</span>
            <h2 id="step-sources-title">{text('维修步骤出处', '作業手順の出典')}</h2>
            <p>{step.instruction}</p>
          </div>
          <button aria-label={text('关闭出处列表', '出典一覧を閉じる')} className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <div className="step-sources-list">
          {sources.length ? (
            sources.map(({ item, sourceLabel }) => (
              <button key={item.id} onClick={() => onOpenEvidence(item)} type="button">
                <span>{sourceLabel}</span>
                <strong>{item.title}</strong>
                <small>{item.trustLabel === 'AUTHORITATIVE' ? text('官方手册', '公式マニュアル') : text('已验证证据', '検証済みの根拠')}</small>
                <ChevronRight aria-hidden="true" size={17} />
              </button>
            ))
          ) : (
            <p className="muted-copy">{text('该步骤暂无可追溯的原文出处。', 'この手順には追跡可能な原文出典がありません。')}</p>
          )}
        </div>
      </section>
    </div>
  )
}
