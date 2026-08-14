import { ChevronRight, FileText, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api } from '../../api'
import { useLanguage } from '../../i18n'
import type { EvidenceItem, SavedReport } from '../../model'
import { statusLabel } from '../../model/presentation'
import { formatSavedAt } from '../../common/util/date'
import { DiagnosisResults } from '../../component/diagnosis/DiagnosisResults'
import { EvidenceDialog } from '../../component/evidence/EvidenceDialog'

/** 诊断报告库：读取历史快照并支持查看其保存时的诊断结果。 */
export function ReportsPage() {
  const { language, text } = useLanguage()
  const [reports, setReports] = useState<SavedReport[]>([])
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null)
  const [selectedEvidence, setSelectedEvidence] =
    useState<EvidenceItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .listReports()
      .then((items) => {
        if (!cancelled) {
          setReports(items)
          setSelectedReport(items[0] ?? null)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : text('诊断报告加载失败。', '診断レポートの読込に失敗しました。'),
          )
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main>
      <section className="page-heading">
        <div>
          <span className="eyebrow">SAVED REPORTS</span>
          <h1>{text('诊断报告', '診断レポート')}</h1>
        </div>
        <p>
          {text(
            '这里只保留用户主动保存的诊断结果，避免无效会话堆积。',
            'ユーザーが明示的に保存した診断結果だけを保管します。',
          )}
        </p>
      </section>

      {errorMessage && (
        <div className="error-notice" role="alert">
          <TriangleAlert size={17} />
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <section className="empty-analysis">
          <LoaderCircle className="spin" size={28} />
          <strong>{text('正在读取已保存报告', '保存済みレポートを読込中')}</strong>
        </section>
      ) : reports.length ? (
        <section className="reports-layout">
          <aside className="report-list">
            <header>
              <span className="eyebrow">SAVED SNAPSHOTS</span>
              <h2>{text('已保存报告', '保存済みレポート')}</h2>
              <strong>{reports.length}</strong>
            </header>
            <div>
              {reports.map((report) => (
                <button
                  className={selectedReport?.id === report.id ? 'active' : ''}
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  type="button"
                >
                  <FileText size={17} />
                  <span>
                    <strong>{report.reportName}</strong>
                    <small>
                      {report.stage === 'ONSITE'
                        ? text('现场分析', '現場分析')
                        : text('出发前分析', '出発前分析')}{' '}
                      · {formatSavedAt(report.savedAt, language)}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))}
            </div>
          </aside>
          <div className="report-detail">
            {selectedReport && (
              <>
                <section className="report-summary">
                  <div>
                    <span className="eyebrow">DIAGNOSIS REPORT</span>
                    <h2>{selectedReport.reportName}</h2>
                    <p>
                      {text('报告保存于', '保存日時')}{' '}
                      {formatSavedAt(selectedReport.savedAt, language)}。
                      {text(
                        '内容为当时诊断会话的不可变快照。',
                        '内容は診断時点の変更不可スナップショットです。',
                      )}
                    </p>
                  </div>
                  <div>
                    <span>
                      {selectedReport.stage === 'ONSITE'
                        ? text('现场', '現場')
                        : text('出发前', '出発前')}
                    </span>
                    <strong>
                      {statusLabel(selectedReport.diagnosisStatus, language)}
                    </strong>
                  </div>
                </section>
                <DiagnosisResults
                  diagnosis={selectedReport.snapshot}
                  onOpenEvidence={setSelectedEvidence}
                />
              </>
            )}
          </div>
        </section>
      ) : (
        <section className="empty-analysis">
          <FileText size={28} />
          <strong>{text('暂无已保存报告', '保存済みレポートはありません')}</strong>
          <p>
            {text(
              '完成诊断后点击“保存报告”，这里才会出现记录。',
              '診断完了後に「レポートを保存」をクリックすると、ここに表示されます。',
            )}
          </p>
        </section>
      )}

      {selectedEvidence && (
        <EvidenceDialog
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </main>
  )
}
