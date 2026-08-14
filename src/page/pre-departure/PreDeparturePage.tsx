import { BrainCircuit, ChevronRight, Database, LoaderCircle, Search, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../api'
import { navigate } from '../../common/hook/useAppRoute'
import { setActiveDiagnosisSessionId } from '../../common/storage/diagnosis-session-storage'

// 演示用报障文本，便于快速体验问题理解和出发前诊断流程。
const demoScenarios = [
  {
    id: 'standard',
    titleZh: '标准可信诊断',
    titleJa: '標準診断',
    descriptionZh: '完整信息，一次进入证据检索与诊断。',
    descriptionJa: '必要情報をそろえ、証拠検索と診断へ進みます。',
    questionZh:
      'RIR1-SSB 冷却效果明显下降，背面发热，显示 E4。设备仍在运行，柜内实测温度 12°C，异常从今天午后开始并持续发生。',
    questionJa:
      'RIR1-SSB の冷却能力が著しく低下し、背面が熱く、E4を表示しています。運転は継続中で、庫内実測温度は12°Cです。本日午後から継続して発生しています。',
  },
  {
    id: 'clarification',
    titleZh: '信息补全演示',
    titleJa: '情報補完デモ',
    descriptionZh: '故意缺少运行状态和测量值，展示强提示。',
    descriptionJa: '運転状態と測定値を省略し、入力支援を確認します。',
    questionZh: 'RIR1-SSB 显示 E4，冷却效果下降，背面发热。',
    questionJa: 'RIR1-SSB で E4 が表示され、冷却能力が低下し、背面が熱くなっています。',
  },
  {
    id: 'onsite',
    titleZh: '现场收敛演示',
    titleJa: '現場絞り込みデモ',
    descriptionZh: '完成出发前判断后，继续确认冷凝器状态。',
    descriptionJa: '出発前診断後、凝縮器の状態を現場で確認します。',
    questionZh:
      'RIR1-SSB 显示 E4，冷却能力下降并反复启停。背面明显发热，过滤网上可以看到积尘，柜内实测温度 11°C，问题从今天高峰期开始。',
    questionJa:
      'RIR1-SSB で E4 が表示され、冷却能力が低下して起動と停止を繰り返します。背面が著しく熱く、フィルタにほこりが見えます。庫内実測温度は11°Cで、本日の繁忙時間帯から発生しています。',
  },
] as const
import { useLanguage } from '../../i18n'
import type { DiagnosisSession, EvidenceItem, ProblemUnderstanding } from '../../model'
import { UnderstandingPanel } from '../../component/diagnosis/UnderstandingPanel'
import { AnalysisOverlay } from '../../component/diagnosis/AnalysisOverlay'
import { RecommendedConfirm } from '../../component/diagnosis/RecommendedConfirm'
import { DiagnosisResults } from '../../component/diagnosis/DiagnosisResults'
import { EvidenceDialog } from '../../component/evidence/EvidenceDialog'

/** 出发前工作台：输入报障、确认字段完整性并发起初步诊断。 */
export function PreDeparturePage() {
  const { language, text } = useLanguage()
  const [selectedDemoId, setSelectedDemoId] = useState<string>('standard')
  const [question, setQuestion] = useState<string>(() =>
    language === 'ja-JP'
      ? demoScenarios[0].questionJa
      : demoScenarios[0].questionZh,
  )
  const [understanding, setUnderstanding] =
    useState<ProblemUnderstanding | null>(null)
  const [diagnosis, setDiagnosis] = useState<DiagnosisSession | null>(null)
  const [isUnderstanding, setIsUnderstanding] = useState(false)
  const [isDiagnosing, setIsDiagnosing] = useState(false)
  const [showRecommendedConfirm, setShowRecommendedConfirm] = useState(false)
  const [selectedEvidence, setSelectedEvidence] =
    useState<EvidenceItem | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSavingReport, setIsSavingReport] = useState(false)
  const [savedReportId, setSavedReportId] = useState<string | null>(null)

  const recommendedMissing = useMemo(
    () =>
      understanding?.fields.filter(
        (field) => field.level === 'B' && (field.state === 'MISSING' || field.state === 'NOT_REQUIRED'),
      ) ?? [],
    [understanding],
  )

  const analyze = async () => {
    if (!question.trim()) return
    setIsUnderstanding(true)
    setErrorMessage(null)
    setDiagnosis(null)

    try {
      const result = await api.understandProblem({
        stage: 'PRE_DEPARTURE',
        language,
        originalText: question,
      })
      setUnderstanding(result)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : text('问题理解失败，请稍后重试。', '問題理解に失敗しました。再試行してください。'),
      )
    } finally {
      setIsUnderstanding(false)
    }
  }

  const requestDiagnosis = () => {
    if (!understanding?.readyForAnalysis) return
    if (recommendedMissing.length > 0) {
      setShowRecommendedConfirm(true)
      return
    }
    void startDiagnosis(false)
  }

  const startDiagnosis = async (continueWithoutRecommendedFields: boolean) => {
    if (!understanding) return
    setShowRecommendedConfirm(false)
    setIsDiagnosing(true)
    setErrorMessage(null)

    try {
      const [result] = await Promise.all([
        api.startDiagnosis({
          problemUnderstandingId: understanding.id,
          continueWithoutRecommendedFields,
        }),
        new Promise((resolve) => window.setTimeout(resolve, 2800)),
      ])
      setDiagnosis(result)
      setActiveDiagnosisSessionId(result.id)
      window.setTimeout(() => {
        document
          .getElementById('diagnosis-result')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : text('AI 诊断失败，请稍后重试。', 'AI診断に失敗しました。再試行してください。'),
      )
    } finally {
      setIsDiagnosing(false)
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

  return (
    <main>
      <section className="page-heading">
        <div>
          <span className="eyebrow">PRE-DEPARTURE ANALYSIS</span>
          <h1>{text('出发前故障分析', '出発前故障分析')}</h1>
        </div>
        <p>
          {text(
            '先把现场描述转化为问题模型，再按设备与故障类型组织企业维修知识。',
            '現場の説明を問題モデルに変換し、機器と故障分類に基づいて保守知識を整理します。',
          )}
        </p>
      </section>

      <section
        className="workflow"
        aria-label={text('诊断流程', '診断フロー')}
      >
        <div className="workflow-step active">
          <span>01</span>
          <strong>{text('描述问题', '問題入力')}</strong>
        </div>
        <ChevronRight size={18} />
        <div className={understanding ? 'workflow-step active' : 'workflow-step'}>
          <span>02</span>
          <strong>{text('确认理解', '理解確認')}</strong>
        </div>
        <ChevronRight size={18} />
        <div className={diagnosis ? 'workflow-step active' : 'workflow-step'}>
          <span>03</span>
          <strong>{text('检索与诊断', '検索・診断')}</strong>
        </div>
      </section>

      <section className="input-band">
        <div className="section-title">
          <BrainCircuit size={19} />
          <div>
            <h2>{text('描述设备问题', '機器の問題を入力')}</h2>
            <p>
              {text(
                '输入型号、错误码、症状、运行状态，以及已经确认的现场信息。',
                '型式、エラーコード、症状、運転状態、確認済みの現場情報を入力します。',
              )}
            </p>
          </div>
        </div>
        <div className="demo-scenarios" aria-label={text('典型演示案例', 'デモシナリオ')}>
          <div className="demo-scenario-label">
            <span>{text('典型 Demo', 'デモケース')}</span>
            <small>{text('选择后自动填充', '選択すると自動入力')}</small>
          </div>
          {demoScenarios.map((scenario) => (
            <button
              className={selectedDemoId === scenario.id ? 'active' : undefined}
              key={scenario.id}
              onClick={() => {
                setSelectedDemoId(scenario.id)
                setQuestion(
                  language === 'ja-JP'
                    ? scenario.questionJa
                    : scenario.questionZh,
                )
                setUnderstanding(null)
                setDiagnosis(null)
                setSavedReportId(null)
              }}
              type="button"
            >
              <strong>
                {language === 'ja-JP' ? scenario.titleJa : scenario.titleZh}
              </strong>
              <span>
                {language === 'ja-JP'
                  ? scenario.descriptionJa
                  : scenario.descriptionZh}
              </span>
            </button>
          ))}
        </div>
        <textarea
          aria-label={text('故障问题', '故障内容')}
          maxLength={4000}
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value)
            setSelectedDemoId('')
            setUnderstanding(null)
            setDiagnosis(null)
          }}
        />
        <div className="input-actions">
          <span>{question.length} / 4000</span>
          <button
            className="primary-button"
            disabled={!question.trim() || isUnderstanding}
            onClick={analyze}
            type="button"
          >
            {isUnderstanding ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Search size={17} />
            )}
            {isUnderstanding
              ? text('正在理解问题', '問題を解析中')
              : text('分析问题', '問題を解析')}
          </button>
        </div>
      </section>

      {errorMessage && (
        <div className="error-notice" role="alert">
          <TriangleAlert size={17} />
          <span>{errorMessage}</span>
        </div>
      )}

      {understanding ? (
        <UnderstandingPanel
          diagnosisReady={Boolean(diagnosis)}
          onStart={requestDiagnosis}
          understanding={understanding}
        />
      ) : (
        <section className="empty-analysis">
          <Database size={28} />
          <strong>{text('等待问题分析', '問題解析待ち')}</strong>
          <p>
            {text(
              '系统将优先生成结构化查询，证据不足时再进入语义检索。',
              '構造化検索を優先し、証拠が不足する場合のみ意味検索を実行します。',
            )}
          </p>
        </section>
      )}

      {diagnosis && (
        <DiagnosisResults
          diagnosis={diagnosis}
          isSavingReport={isSavingReport}
          onEnterOnsite={() => navigate('/onsite')}
          onOpenEvidence={setSelectedEvidence}
          onSaveReport={() => void saveCurrentReport()}
          reportSaved={Boolean(savedReportId)}
        />
      )}

      {isDiagnosing && <AnalysisOverlay />}
      {showRecommendedConfirm && understanding && (
        <RecommendedConfirm
          fields={recommendedMissing}
          onCancel={() => setShowRecommendedConfirm(false)}
          onContinue={() => void startDiagnosis(true)}
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
