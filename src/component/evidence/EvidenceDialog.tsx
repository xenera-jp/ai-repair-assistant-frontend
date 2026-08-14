import { FileCheck2, X } from 'lucide-react'
import { useLanguage } from '../../i18n'
import type { EvidenceItem } from '../../model'
import { PdfEvidenceViewer } from './PdfEvidenceViewer'

/** 弹窗展示候选结论关联的证据列表，并可继续打开 PDF 原文。 */
export function EvidenceDialog({
  evidence,
  onClose,
}: {
  evidence: EvidenceItem
  onClose: () => void
}) {
  const { text } = useLanguage()
  const hasSourcePdf = Boolean(evidence.sourceDocument)

  return (
    <div className="dialog-backdrop evidence-backdrop" role="presentation">
      <section
        aria-labelledby="evidence-title"
        aria-modal="true"
        className={
          hasSourcePdf
            ? 'evidence-dialog evidence-dialog-with-pdf'
            : 'evidence-dialog'
        }
        role="dialog"
      >
        <header>
          <div>
            <span className="eyebrow">EVIDENCE READER</span>
            <h2 id="evidence-title">{evidence.title}</h2>
          </div>
          <button
            aria-label={text('关闭证据', '証拠を閉じる')}
            className="icon-button"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="evidence-dialog-meta">
          <span>
            <FileCheck2 size={14} />
            {evidence.trustLabel === 'VERIFIED_CASE'
              ? text('已验证维修结果', '検証済み修理結果')
              : evidence.trustLabel === 'AUTHORITATIVE'
                ? text('官方服务手册', '公式サービスマニュアル')
                : evidence.trustLabel === 'USER_CONFIRMED'
                  ? text('工程师现场确认', 'サービス担当者の現場確認')
                  : text('历史备件记录', '過去の使用部品記録')}
          </span>
          <span>{evidence.id}</span>
        </div>
        <div className="evidence-reader-body">
          <div className="evidence-document">
            <h3>{text('证据摘要', '証拠要約')}</h3>
            <p>{evidence.summary}</p>
            <h3>{text('来源定位', '出典位置')}</h3>
            <p>{evidence.sourceReference}</p>
            {evidence.sourceDocument && (
              <>
                <h3>{text('原文引用', '原文引用')}</h3>
                <blockquote>{evidence.sourceDocument.sourceQuote}</blockquote>
              </>
            )}
          </div>
          {evidence.sourceDocument && (
            <PdfEvidenceViewer source={evidence.sourceDocument} />
          )}
        </div>
        <footer>
          <span>{text('命中信号', '一致シグナル')}</span>
          <div>
            {evidence.matchedSignals.map((signal) => (
              <strong key={signal}>{signal}</strong>
            ))}
          </div>
        </footer>
      </section>
    </div>
  )
}
