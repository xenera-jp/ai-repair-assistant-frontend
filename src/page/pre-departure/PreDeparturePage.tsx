import { BrainCircuit, ChevronRight, ChevronsLeft, ChevronsRight, Database, LoaderCircle, Search, TriangleAlert } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  {
    id: 'e6-shutdown',
    titleZh: 'E6 高压停机',
    titleJa: 'E6 高電圧停止',
    descriptionZh: '验证错误码、停机状态与官方手册证据。',
    descriptionJa: 'エラーコード、停止状態、公式マニュアルの根拠を確認します。',
    questionZh:
      'FH1-SSB 显示 E6，高电压报警后压缩机停止运行，目前无法恢复制冷。现场供电未做调整，故障从今天上午开始。',
    questionJa:
      'FH1-SSB で E6 が表示され、高電圧警報後にコンプレッサーが停止しました。現在は冷却を再開できません。現場の電源設定は変更しておらず、本日午前から発生しています。',
  },
  {
    id: 'e8-temperature',
    titleZh: 'E8 温度跳变',
    titleJa: 'E8 温度表示異常',
    descriptionZh: '验证传感器、配线与显示回路诊断。',
    descriptionJa: 'センサー、配線、表示回路の診断を確認します。',
    questionZh:
      'FH1-SSB 显示 E8，温度显示反复跳动，与独立温度计测量结果明显不一致。设备仍在运行，柜内实际温度较稳定。',
    questionJa:
      'FH1-SSB で E8 が表示され、温度表示が繰り返し変動します。独立温度計の測定値と大きく一致しません。機器は運転中で、庫内の実温度は比較的安定しています。',
  },
  {
    id: 'e9-defrost',
    titleZh: 'E9 除霜异常',
    titleJa: 'E9 除霜異常',
    descriptionZh: '验证结霜现象与除霜系统的证据链。',
    descriptionJa: '霜付き症状と除霜系統の証拠チェーンを確認します。',
    questionZh:
      'FH1-SSB 显示 E9，蒸发器结霜严重，自动除霜后冰霜仍未完全融化。设备制冷能力下降，但风机仍在运行。',
    questionJa:
      'FH1-SSB で E9 が表示され、蒸発器に著しい霜付きがあります。自動除霜後も霜が完全に溶けません。冷却能力は低下していますが、ファンは運転しています。',
  },
  {
    id: 'no-code-startup',
    titleZh: '无错误码启动',
    titleJa: 'コードなし起動不良',
    descriptionZh: '没有错误码，依靠症状完成问题分类。',
    descriptionJa: 'エラーコードなしで、症状から問題を分類します。',
    questionZh:
      'FH1-AAC 主电源已经开启，但压缩机没有启动，也测不到运行电流。控制面板未显示错误码，照明和风机可以正常工作。',
    questionJa:
      'FH1-AAC の主電源は入っていますが、コンプレッサーが起動せず、運転電流も測定できません。エラーコードは表示されず、照明とファンは正常に動作しています。',
  },
  {
    id: 'showcase-frost',
    titleZh: '展示柜严重结霜',
    titleJa: 'ショーケース霜付き',
    descriptionZh: '验证环境湿度、开门频率与结霜判断。',
    descriptionJa: '環境湿度、扉の開閉頻度、霜付き判断を確認します。',
    questionZh:
      'HNC-120AA 展示柜内部结霜严重，门每天频繁打开，现场环境湿度约 70%。设备没有显示错误码，制冷仍在运行。',
    questionJa:
      'HNC-120AA ショーケース内部に著しい霜付きがあります。扉は毎日頻繁に開閉され、現場湿度は約70%です。エラーコードはなく、冷却運転は継続しています。',
  },
] as const
import { useLanguage } from '../../i18n'
import type { DiagnosisSession, EvidenceItem, ProblemUnderstanding } from '../../model'
import { UnderstandingPanel } from '../../component/diagnosis/UnderstandingPanel'
import { AnalysisOverlay } from '../../component/diagnosis/AnalysisOverlay'
import { RecommendedConfirm } from '../../component/diagnosis/RecommendedConfirm'
import { DiagnosisResults } from '../../component/diagnosis/DiagnosisResults'
import { EvidenceDialog } from '../../component/evidence/EvidenceDialog'

function getRecommendedMissing(understanding: ProblemUnderstanding) {
  return understanding.fields.filter(
    (field) => field.level === 'B' && (field.state === 'MISSING' || field.state === 'NOT_REQUIRED'),
  )
}

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
  const [recordingBatchId, setRecordingBatchId] = useState<string | null>(null)
  const demoScenarioTrackRef = useRef<HTMLDivElement>(null)
  const [canScrollDemoLeft, setCanScrollDemoLeft] = useState(false)
  const [canScrollDemoRight, setCanScrollDemoRight] = useState(true)

  const startDiagnosis = useCallback(async (
    currentUnderstanding: ProblemUnderstanding,
    continueWithoutRecommendedFields: boolean,
  ) => {
    if (!currentUnderstanding.readyForAnalysis) return
    setShowRecommendedConfirm(false)
    setIsDiagnosing(true)
    setErrorMessage(null)

    try {
      const [result] = await Promise.all([
        api.startDiagnosis({
          problemUnderstandingId: currentUnderstanding.id,
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
  }, [text])

  // 录音来源与手动按钮共用同一个完整性检查入口。
  const requestDiagnosis = useCallback((
    currentUnderstanding: ProblemUnderstanding,
  ) => {
    if (!currentUnderstanding.readyForAnalysis) return
    if (getRecommendedMissing(currentUnderstanding).length > 0) {
      setShowRecommendedConfirm(true)
      return
    }
    void startDiagnosis(currentUnderstanding, false)
  }, [startDiagnosis])

  useEffect(() => {
    const historyState = window.history.state as { recordingProblemDescription?: unknown; recordingBatchId?: unknown } | null
    const problemDescription = typeof historyState?.recordingProblemDescription === 'string'
      ? historyState.recordingProblemDescription
      : null
    const batchId = typeof historyState?.recordingBatchId === 'string' ? historyState.recordingBatchId : null
    if (!problemDescription) return
    setRecordingBatchId(batchId)
    setQuestion(problemDescription)
    setSelectedDemoId('')
    setUnderstanding(null)
    setDiagnosis(null)
    window.history.replaceState({}, '', window.location.pathname)
  }, [])

  useEffect(() => {
    const track = demoScenarioTrackRef.current
    if (!track) return

    const updateScrollControls = () => {
      const maximum = track.scrollWidth - track.clientWidth
      setCanScrollDemoLeft(track.scrollLeft > 4)
      setCanScrollDemoRight(track.scrollLeft < maximum - 4)
    }

    updateScrollControls()
    track.addEventListener('scroll', updateScrollControls, { passive: true })
    const resizeObserver = new ResizeObserver(updateScrollControls)
    resizeObserver.observe(track)
    return () => {
      track.removeEventListener('scroll', updateScrollControls)
      resizeObserver.disconnect()
    }
  }, [])

  const scrollDemoScenarios = (direction: -1 | 1) => {
    demoScenarioTrackRef.current?.scrollBy({
      behavior: 'smooth',
      left: direction * Math.max(demoScenarioTrackRef.current.clientWidth * 0.82, 280),
    })
  }

  const recommendedMissing = useMemo(
    () =>
      understanding ? getRecommendedMissing(understanding) : [],
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
          <div className="demo-scenario-carousel">
            <button aria-label={text('查看上一组案例', '前のケースを表示')} className="demo-scroll-control" disabled={!canScrollDemoLeft} onClick={() => scrollDemoScenarios(-1)} type="button">
              <ChevronsLeft size={21} />
            </button>
            <div className="demo-scenario-track" ref={demoScenarioTrackRef}>
              {demoScenarios.map((scenario) => (
                <button
                  className={`demo-scenario-card${selectedDemoId === scenario.id ? ' active' : ''}`}
                  key={scenario.id}
                  onClick={() => {
                    setSelectedDemoId(scenario.id)
                    setRecordingBatchId(null)
                    setQuestion(language === 'ja-JP' ? scenario.questionJa : scenario.questionZh)
                    setUnderstanding(null)
                    setDiagnosis(null)
                    setSavedReportId(null)
                  }}
                  type="button"
                >
                  <strong>{language === 'ja-JP' ? scenario.titleJa : scenario.titleZh}</strong>
                  <span>{language === 'ja-JP' ? scenario.descriptionJa : scenario.descriptionZh}</span>
                </button>
              ))}
            </div>
            <button aria-label={text('查看下一组案例', '次のケースを表示')} className="demo-scroll-control" disabled={!canScrollDemoRight} onClick={() => scrollDemoScenarios(1)} type="button">
              <ChevronsRight size={21} />
            </button>
          </div>
        </div>
        <textarea
          aria-label={text('故障问题', '故障内容')}
          maxLength={4000}
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value)
            setRecordingBatchId(null)
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
          onStart={() => requestDiagnosis(understanding)}
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
          onCancel={() => {
            if (!recordingBatchId) {
              setShowRecommendedConfirm(false)
              return
            }
            window.history.pushState({ recordingBatchId, focusRecordingEditor: true }, '', '/recordings')
            window.dispatchEvent(new PopStateEvent('popstate'))
          }}
          onContinue={() => void startDiagnosis(understanding, true)}
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
