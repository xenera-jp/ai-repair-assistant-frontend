import { ArrowRight, CheckCircle2, CircleAlert, LoaderCircle, RotateCcw, TriangleAlert, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../api'
import { AppLink } from '../../common/component/AppLink'
import { getActiveDiagnosisSessionId, setActiveDiagnosisSessionId } from '../../common/storage/diagnosis-session-storage'
import { useLanguage } from '../../i18n'
import type { DiagnosisSession, EvidenceItem, OnsiteQuestionResponse, ProblemUnderstanding, RejectionRequest } from '../../model'
import { statusLabel } from '../../model/presentation'
import { fieldValue } from '../../model/presentation'
import { AnalysisOverlay } from '../../component/diagnosis/AnalysisOverlay'
import { DiagnosisResults } from '../../component/diagnosis/DiagnosisResults'
import { ReanalysisUnderstandingDialog } from '../../component/onsite/ReanalysisUnderstandingDialog'
import { RejectionDialog } from '../../component/onsite/RejectionDialog'
import { OnsiteQuestionPanel } from '../../component/onsite/OnsiteQuestionPanel'
import { EvidenceDialog } from '../../component/evidence/EvidenceDialog'

/** 现场工作台：恢复会话、逐轮回答验证问题并处理否定重分析。 */
export function OnsitePage() {
  const { language, text } = useLanguage()
  const [diagnosis, setDiagnosis] = useState<DiagnosisSession | null>(null)
  const [selectedEvidence, setSelectedEvidence] =
    useState<EvidenceItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [analysisOverlayMode, setAnalysisOverlayMode] = useState<
    'ONSITE' | 'ONSITE_REANALYSIS'
  >('ONSITE')
  const [isSavingReport, setIsSavingReport] = useState(false)
  const [showRejection, setShowRejection] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [reanalysisPreparation, setReanalysisPreparation] = useState<{
    sourceSessionId: string
    request: RejectionRequest
    understanding: ProblemUnderstanding
  } | null>(null)
  const [savedReportId, setSavedReportId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  // State updates take effect on the next render. Keep a synchronous lock as
  // well, so a double-click cannot submit the same question twice.
  const isAnswerSubmitting = useRef(false)

  useEffect(() => {
    let cancelled = false
    const sessionId = getActiveDiagnosisSessionId()
    if (!sessionId) {
      setIsLoading(false)
      return
    }

    const load = async () => {
      try {
        const current = await api.getDiagnosis(sessionId)
        const onsite =
          current.stage === 'ONSITE' ? current : await api.enterOnsite(current.id)
        if (!cancelled) {
          setDiagnosis(onsite)
          setActiveDiagnosisSessionId(onsite.id)
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : text(
                '现场诊断会话加载失败，请重新开始出发前分析。',
                '現場診断セッションを読み込めません。出発前分析からやり直してください。',
              ),
          )
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const answerQuestion = async (response: OnsiteQuestionResponse) => {
    if (!diagnosis?.nextQuestion || isAnswerSubmitting.current) return
    isAnswerSubmitting.current = true
    setAnalysisOverlayMode('ONSITE')
    setIsReanalyzing(true)
    setErrorMessage(null)
    try {
      const [updated] = await Promise.all([
        api.answerOnsiteQuestion(
          diagnosis.id,
          diagnosis.nextQuestion.id,
          response,
        ),
        new Promise((resolve) => window.setTimeout(resolve, 1700)),
      ])
      setDiagnosis(updated)
    } catch (error) {
      if (error instanceof Error && error.message.includes('HTTP 409')) {
        try {
          setDiagnosis(await api.getDiagnosis(diagnosis.id))
        } catch {
          // Preserve the original submission error if the recovery refresh fails.
        }
      }
      setErrorMessage(
        error instanceof Error
          ? error.message
          : text('现场信息提交失败，请重试。', '現場情報の送信に失敗しました。'),
      )
    } finally {
      isAnswerSubmitting.current = false
      setIsReanalyzing(false)
    }
  }

  const saveCurrentReport = async () => {
    if (!diagnosis) return
    setIsSavingReport(true)
    setErrorMessage(null)
    try {
      const report = await api.saveReport(diagnosis.id)
      setSavedReportId(report.id)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : text('报告保存失败，请稍后重试。', 'レポートの保存に失敗しました。'),
      )
    } finally {
      setIsSavingReport(false)
    }
  }

  const rejectDiagnosis = async (request: RejectionRequest) => {
    if (!diagnosis) return
    setIsRejecting(true)
    setErrorMessage(null)
    try {
      const understanding = await api.rejectDiagnosis(diagnosis.id, request)
      setReanalysisPreparation({
        sourceSessionId: diagnosis.id,
        request,
        understanding,
      })
      setSavedReportId(null)
      setShowRejection(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : text('否定分析失败，请稍后重试。', '分析の否定に失敗しました。再試行してください。'))
    } finally {
      setIsRejecting(false)
    }
  }

  const startPreparedRediagnosis = async () => {
    if (!reanalysisPreparation) return
    const preparation = reanalysisPreparation
    // 先关闭问题理解弹窗，避免它与全屏 AI 分析动画处于同一层级而遮挡动画。
    setReanalysisPreparation(null)
    setAnalysisOverlayMode('ONSITE_REANALYSIS')
    setIsReanalyzing(true)
    setErrorMessage(null)
    try {
      const [updated] = await Promise.all([
        api.startOnsiteRediagnosis(preparation.sourceSessionId, {
          problemUnderstandingId: preparation.understanding.id,
          rejection: preparation.request,
        }),
        new Promise((resolve) => window.setTimeout(resolve, 2800)),
      ])
      setDiagnosis(updated)
      setReanalysisPreparation(null)
      setActiveDiagnosisSessionId(updated.id)
    } catch (error) {
      setReanalysisPreparation(preparation)
      setErrorMessage(error instanceof Error ? error.message : text('AI 诊断失败，请稍后重试。', 'AI診断に失敗しました。再試行してください。'))
    } finally {
      setIsReanalyzing(false)
    }
  }

  return (
    <main>
      <section className="page-heading">
        <div>
          <span className="eyebrow">ONSITE REFINEMENT</span>
          <h1>{text('现场分析', '現場分析')}</h1>
        </div>
        <p>
          {text(
            '继承出发前结论，通过一次一个问题继续缩小候选范围。',
            '出発前診断を引き継ぎ、1問ずつ確認して候補を絞り込みます。',
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
          <strong>{text('正在加载现场会话', '現場セッションを読込中')}</strong>
          <p>{text('读取出发前结论与待确认信号。', '出発前診断と確認対象シグナルを読み込んでいます。')}</p>
        </section>
      ) : diagnosis ? (
        <>
          <section className="onsite-context">
            <div>
              <span className="eyebrow">ACTIVE DIAGNOSIS SESSION</span>
              <h2>
                {fieldValue(diagnosis, 'equipmentModel', language)} ·{' '}
                {diagnosis.problemUnderstanding.primaryProblemType.label}
              </h2>
              <p>{diagnosis.problemUnderstanding.summary}</p>
            </div>
            <div className="onsite-context-actions">
              {diagnosis.status !== 'REJECTED' && (
                <div className="reanalysis-entry">
                  <div className="reanalysis-notice">
                    <CircleAlert size={27} />
                    <span>
                      <strong>{text('现场情况与初步诊断不一致？', '現場状況が初期診断と一致しませんか？')}</strong>
                      <small>{text('补充或修改现场现象后，系统将重新理解问题并检索证据。', '現場の状況を補足・修正すると、問題を再理解して証拠を検索します。')}</small>
                    </span>
                  </div>
                  <button
                    className="reject-diagnosis-button other-observation-button"
                    disabled={isReanalyzing || isSavingReport || isRejecting}
                    onClick={() => setShowRejection(true)}
                    type="button"
                  >
                    <RotateCcw size={17} />
                    {text('修改描述并重新分析', '説明を修正して再分析')}
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <div className="session-facts">
                <span>
                  <strong>{diagnosis.candidates.length}</strong>
                  {text('当前候选', '現在の候補')}
                </span>
                <span>
                  <strong>{diagnosis.nextQuestion?.round ?? '—'}</strong>
                  {text('现场轮次', '現場ラウンド')}
                </span>
                <span>
                  <strong>{statusLabel(diagnosis.status, language)}</strong>
                  {text('当前状态', '現在の状態')}
                </span>
              </div>
            </div>
          </section>

          {diagnosis.status === 'REJECTED' ? (
            <section className="onsite-complete rejection-complete">
              <CircleAlert size={25} />
              <div>
                <span className="eyebrow">REJECTED SESSION</span>
                <h2>{text('该现场会话已被否定', 'この現場セッションは否定されました')}</h2>
              </div>
            </section>
          ) : diagnosis.nextQuestion ? (
            <OnsiteQuestionPanel
              disabled={isReanalyzing}
              key={diagnosis.nextQuestion.id}
              onAnswer={(response) => void answerQuestion(response)}
              question={diagnosis.nextQuestion}
            />
          ) : (
            <section className="onsite-complete">
              <CheckCircle2 size={25} />
              <div>
                <span className="eyebrow">ONSITE RESULT</span>
                <h2>
                  {diagnosis.status === 'CONVERGED'
                    ? text('现场结论已收敛', '現場結論が収束しました')
                    : text('本次现场追问已结束', '今回の現場確認は終了しました')}
                </h2>
                <p>
                  {text(
                    '系统已保留全部回答和证据变化。确认无误后，可将当前快照保存为诊断报告。',
                    'すべての回答と証拠の変化を保存しました。確認後、現在のスナップショットを診断レポートとして保存できます。',
                  )}
                </p>
              </div>
            </section>
          )}

          <DiagnosisResults
            diagnosis={diagnosis}
            isSavingReport={isSavingReport}
            onOpenEvidence={setSelectedEvidence}
            onSaveReport={() => void saveCurrentReport()}
            reportSaved={Boolean(savedReportId)}
          />
        </>
      ) : (
        <section className="empty-analysis">
          <Wrench size={28} />
          <strong>{text('没有可继续的诊断会话', '継続可能な診断セッションがありません')}</strong>
          <p>{text('先完成一次出发前分析，再进入现场确认。', '先に出発前分析を完了してください。')}</p>
          <AppLink className="inline-link" to="/pre-departure">
            {text('返回出发前分析', '出発前分析へ戻る')}
            <ArrowRight size={14} />
          </AppLink>
        </section>
      )}

      {isReanalyzing && <AnalysisOverlay mode={analysisOverlayMode} />}
      {reanalysisPreparation && (
        <ReanalysisUnderstandingDialog
          onCancel={() => setReanalysisPreparation(null)}
          onStart={() => void startPreparedRediagnosis()}
          understanding={reanalysisPreparation.understanding}
        />
      )}
      {showRejection && diagnosis && (
        <RejectionDialog
          initialObservation={diagnosis.problemUnderstanding.originalText}
          isSubmitting={isRejecting}
          onCancel={() => setShowRejection(false)}
          onSubmit={(request) => void rejectDiagnosis(request)}
          sessionTitle={`${fieldValue(diagnosis, 'equipmentModel', language)} · ${diagnosis.problemUnderstanding.primaryProblemType.label}`}
        />
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
