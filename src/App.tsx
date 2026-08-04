import {
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileCheck2,
  FileText,
  Gauge,
  History,
  LoaderCircle,
  MessageSquareText,
  PackageCheck,
  Radio,
  Search,
  Save,
  ShieldCheck,
  SkipForward,
  Monitor,
  Moon,
  Sun,
  TriangleAlert,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { api } from './api/client'
import { useLanguage } from './i18n'
import type {
  DiagnosisSession,
  EvidenceGroup,
  EvidenceItem,
  OnsiteQuestionResponse,
  ProblemUnderstanding,
  RepairStep,
  SavedReport,
  SystemStatus,
} from './api/types'
import './App.css'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

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

type AppPath = '/pre-departure' | '/onsite' | '/reports'

const routes = new Set<AppPath>(['/pre-departure', '/onsite', '/reports'])

function normalizePath(pathname: string): AppPath {
  return routes.has(pathname as AppPath)
    ? (pathname as AppPath)
    : '/pre-departure'
}

function navigate(path: AppPath) {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function AppLink({
  children,
  className,
  to,
}: {
  children: React.ReactNode
  className?: string
  to: AppPath
}) {
  return (
    <a
      className={className}
      href={to}
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault()
          navigate(to)
        }
      }}
    >
      {children}
    </a>
  )
}

function App() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [path, setPath] = useState(() => normalizePath(window.location.pathname))
  const [themePreference, setThemePreference] = useState<'system' | 'light' | 'dark'>(() => {
    const saved = window.localStorage.getItem('repair-assistant-theme')
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'system'
  })
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  const { language, setLanguage, text } = useLanguage()

  const activeTheme = themePreference === 'system' ? systemTheme : themePreference

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const updateTheme = () => setSystemTheme(media.matches ? 'dark' : 'light')
    updateTheme()
    media.addEventListener('change', updateTheme)
    return () => media.removeEventListener('change', updateTheme)
  }, [])

  const setTheme = (next: 'system' | 'light' | 'dark') => {
    window.localStorage.setItem('repair-assistant-theme', next)
    setThemePreference(next)
  }

  useEffect(() => {
    api.getSystemStatus().then(setSystemStatus).catch(() => setSystemStatus(null))
  }, [])

  useEffect(() => {
    const handleNavigation = () => setPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', handleNavigation)

    if (!routes.has(window.location.pathname as AppPath)) {
      window.history.replaceState({}, '', '/pre-departure')
    }

    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  return (
    <div className="app-shell" data-theme={activeTheme}>
      <header className="topbar">
        <AppLink className="brand" to="/pre-departure">
          <span className="brand-mark">AI</span>
          <span>
            <strong>{text('AI 维修助手', 'AI 修理アシスタント')}</strong>
            <small>Repair Intelligence Workspace</small>
          </span>
        </AppLink>

        <nav aria-label={text('主要导航', 'メインナビゲーション')}>
          <AppLink
            className={path === '/pre-departure' ? 'active' : undefined}
            to="/pre-departure"
          >
            {text('出发前分析', '出発前分析')}
          </AppLink>
          <AppLink
            className={path === '/onsite' ? 'active' : undefined}
            to="/onsite"
          >
            {text('现场分析', '現場分析')}
          </AppLink>
          <AppLink
            className={path === '/reports' ? 'active' : undefined}
            to="/reports"
          >
            {text('诊断报告', '診断レポート')}
          </AppLink>
        </nav>

        <div className="topbar-actions">
          <div
            aria-label={text('切换语言', '言語切替')}
            className="language-switch"
            role="group"
          >
            <button
              aria-pressed={language === 'zh-CN'}
              className={language === 'zh-CN' ? 'active' : undefined}
              onClick={() => setLanguage('zh-CN')}
              type="button"
            >
              中
            </button>
            <button
              aria-pressed={language === 'ja-JP'}
              className={language === 'ja-JP' ? 'active' : undefined}
              onClick={() => setLanguage('ja-JP')}
              type="button"
            >
              日
            </button>
          </div>
          <div
            aria-label={text('界面主题', '画面テーマ')}
            className="theme-switch"
            role="group"
          >
            <button
              aria-label={text('浅色模式', 'ライトモード')}
              aria-pressed={themePreference === 'light'}
              className={themePreference === 'light' ? 'active' : undefined}
              onClick={() => setTheme('light')}
              type="button"
            >
              <Sun size={15} />
            </button>
            <button
              aria-label={text('深色模式', 'ダークモード')}
              aria-pressed={themePreference === 'dark'}
              className={themePreference === 'dark' ? 'active' : undefined}
              onClick={() => setTheme('dark')}
              type="button"
            >
              <Moon size={15} />
            </button>
            <button
              aria-label={text('跟随系统', 'システム設定に合わせる')}
              aria-pressed={themePreference === 'system'}
              className={themePreference === 'system' ? 'active' : undefined}
              onClick={() => setTheme('system')}
              type="button"
            >
              <Monitor size={15} />
            </button>
          </div>
          <span
            className={`connection-state ${systemStatus ? 'online' : 'offline'}`}
          >
            <Radio size={13} />
            {systemStatus
              ? systemStatus.knowledgeVersion
              : text('后端未连接', 'バックエンド未接続')}
          </span>
        </div>
      </header>

      {path === '/pre-departure' && <PreDeparturePage key={language} />}
      {path === '/onsite' && <OnsitePage key={language} />}
      {path === '/reports' && <ReportsPage key={language} />}
    </div>
  )
}

function PreDeparturePage() {
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
        (field) => field.level === 'B' && field.state === 'MISSING',
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
      window.sessionStorage.setItem('activeDiagnosisSessionId', result.id)
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

function UnderstandingPanel({
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
    (field) => field.level === 'B' && field.state === 'MISSING',
  )
  const requiredMissing = understanding.fields.filter(
    (field) => field.level === 'A' && field.state === 'MISSING',
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
              className={`understood-field level-${field.level.toLowerCase()} ${
                field.state === 'MISSING' ? 'is-missing' : ''
              }`}
              key={field.code}
            >
              <span className="field-label">
                {field.label}
                <small>{field.level}</small>
              </span>
              <strong>
                {field.value?.toString() || text('尚未补充', '未入力')}
              </strong>
              <span className="field-meta">
                {field.state === 'MISSING'
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
            : text('开始 AI 诊断', 'AI診断を開始')}
        </button>
      </aside>
    </section>
  )
}

function AnalysisOverlay({ mode = 'INITIAL' }: { mode?: 'INITIAL' | 'ONSITE' }) {
  const { language, text } = useLanguage()
  const phases =
    mode === 'ONSITE'
      ? language === 'ja-JP'
        ? [
            ['現場事実を記録', '確認された情報を現場セッションに記録しています'],
            ['原因候補を検証', '支持・反証シグナルで候補順位を再計算しています'],
            ['証拠チェーンを更新', '現場事実と過去の修理証拠を関連付けています'],
            ['収束判定', '追加質問または現場結論の確定を判断しています'],
          ]
        : [
          ['记录现场事实', '把工程师确认的信息写入现场会话'],
          ['核验候选原因', '根据支持与冲突信号重新计算候选排序'],
          ['更新证据链', '将现场事实与历史维修证据关联'],
          ['判断是否收敛', '决定继续追问或形成现场诊断结论'],
        ]
      : language === 'ja-JP'
        ? [
            ['問題モデルを解析', '機器、故障分類、検索制約を確認しています'],
            ['保守知識を検索', '同一型式・同一問題カテゴリの解決済み事例を優先検索しています'],
            ['履歴証拠を検証', '修理記録、処置結果、実使用部品を関連付けています'],
            ['診断提案を生成', '証拠の範囲内で原因候補と作業手順を構成しています'],
          ]
        : [
            ['解析问题模型', '确认设备、故障分类与检索约束'],
            ['检索维修知识', '优先匹配同型号、同问题类型的已解决案例'],
            ['核验历史证据', '关联维修记录、处理结果与实际使用备件'],
            ['生成诊断建议', '在证据边界内组织候选原因与行动步骤'],
          ]
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => Math.min(current + 1, phases.length - 1))
    }, 640)
    return () => window.clearInterval(timer)
  }, [phases.length])

  return (
    <div className="analysis-overlay" role="status" aria-live="polite">
      <div className="analysis-console">
        <div className="analysis-visual" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="analysis-core">
            <BrainCircuit size={30} />
          </span>
          <span className="scan-line" />
        </div>
        <span className="eyebrow">REPAIR INTELLIGENCE ENGINE</span>
        <h2>
          {mode === 'ONSITE'
            ? text('正在收敛现场结论', '現場結論を絞り込み中')
            : text('正在构建可追溯诊断', '追跡可能な診断を構築中')}
        </h2>
        <p>{phases[phaseIndex][1]}</p>
        <div className="analysis-phases">
          {phases.map(([title], index) => (
            <div
              className={
                index < phaseIndex
                  ? 'complete'
                  : index === phaseIndex
                    ? 'running'
                    : ''
              }
              key={title}
            >
              <span>{index < phaseIndex ? <Check size={13} /> : index + 1}</span>
              <strong>{title}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RecommendedConfirm({
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

function DiagnosisResults({
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
            {diagnosis.evidenceGroups.map((group) => (
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
                {group.items.map((item) => (
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
              </div>
            ))}
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

function StepSourcesDialog({
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

function EvidenceDialog({
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

function PdfEvidenceViewer({
  source,
}: {
  source: NonNullable<EvidenceItem['sourceDocument']>
}) {
  const { text } = useLanguage()
  const viewerRef = useRef<HTMLDivElement>(null)
  const sourceRegionRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(680)
  const [pageNumber, setPageNumber] = useState(source.pdfPage)
  const [pageCount, setPageCount] = useState(0)
  const [zoom, setZoom] = useState(1)
  const documentUrl = api.manualDocumentUrl(source.manualKnowledgeId)
  const sourceRegion = source.sourceRegion

  useEffect(() => {
    const container = viewerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      // Reserve a small inner gutter so zooming never clips the PDF shadow.
      setContainerWidth(Math.max(320, entry.contentRect.width - 28))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const focusSourceRegion = () => {
    window.setTimeout(() => {
      sourceRegionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      })
    }, 0)
  }

  const regionStyle = sourceRegion
    ? {
        left: `calc(${(sourceRegion.x / sourceRegion.pageWidth) * 100}% - 4px)`,
        top: `calc(${(sourceRegion.y / sourceRegion.pageHeight) * 100}% - 3px)`,
        width: `calc(${(sourceRegion.width / sourceRegion.pageWidth) * 100}% + 8px)`,
        height: `calc(${(sourceRegion.height / sourceRegion.pageHeight) * 100}% + 6px)`,
      }
    : undefined

  return (
    <section
      className="pdf-evidence-viewer"
      aria-label={text('原始服务手册', '原本サービスマニュアル')}
    >
      <header className="pdf-toolbar">
        <div>
          <FileText size={16} />
          <span>{source.fileName}</span>
        </div>
        <div className="pdf-toolbar-actions">
          <button
            aria-label={text('上一页', '前のページ')}
            disabled={pageNumber <= 1}
            onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            PDF {pageNumber} / {pageCount || '—'}
          </span>
          <button
            aria-label={text('下一页', '次のページ')}
            disabled={pageCount === 0 || pageNumber >= pageCount}
            onClick={() =>
              setPageNumber((current) => Math.min(pageCount, current + 1))
            }
            type="button"
          >
            <ChevronRight size={16} />
          </button>
          <button
            aria-label={text('缩小', '縮小')}
            disabled={zoom <= 0.8}
            onClick={() => setZoom((current) => Math.max(0.8, current - 0.15))}
            type="button"
          >
            <ZoomOut size={16} />
          </button>
          <button
            aria-label={text('放大', '拡大')}
            disabled={zoom >= 1.6}
            onClick={() => setZoom((current) => Math.min(1.6, current + 0.15))}
            type="button"
          >
            <ZoomIn size={16} />
          </button>
          <a
            aria-label={text('在新窗口打开完整手册', '別ウィンドウでマニュアルを開く')}
            href={`${documentUrl}#page=${source.pdfPage}`}
            rel="noreferrer"
            target="_blank"
          >
            <ExternalLink size={15} />
          </a>
        </div>
      </header>
      <div className="pdf-location-strip">
        <span>{text('已定位原文', '原文位置')}</span>
        <strong>
          PDF P{source.pdfPage}
          {source.printedPage
            ? ` · ${text('手册', '冊子')} P${source.printedPage}`
            : ''}
          {source.sectionPath ? ` · §${source.sectionPath}` : ''}
          {source.sourceAnchor ? ` · ${source.sourceAnchor}` : ''}
        </strong>
      </div>
      <div className="pdf-page-scroll" ref={viewerRef}>
        <Document
          error={
            <div className="pdf-state">
              {text('原始手册加载失败', '原本マニュアルの読込に失敗しました')}
            </div>
          }
          file={documentUrl}
          loading={
            <div className="pdf-state">
              <LoaderCircle className="spin" size={20} />
              {text('正在读取原始服务手册', '原本サービスマニュアルを読込中')}
            </div>
          }
          onLoadSuccess={({ numPages }) => {
            setPageCount(numPages)
            setPageNumber(Math.min(source.pdfPage, numPages))
          }}
        >
          <div
            className="pdf-page-shell"
            style={{ width: containerWidth * zoom }}
          >
            <Page
              canvasBackground="#ffffff"
              loading={
                <div className="pdf-state">
                  {text('正在渲染证据页', '証拠ページを描画中')}
                </div>
              }
              onRenderSuccess={focusSourceRegion}
              pageNumber={pageNumber}
              renderAnnotationLayer
              renderTextLayer
              width={containerWidth * zoom}
            />
            {pageNumber === source.pdfPage && sourceRegion && (
              <div
                aria-label={`${text('原文定位', '原文位置')}：${source.sourceAnchor}`}
                className="pdf-source-region"
                ref={sourceRegionRef}
                style={regionStyle}
              >
                <span>{text('证据原文', '証拠原文')}</span>
              </div>
            )}
          </div>
        </Document>
      </div>
    </section>
  )
}

function OnsitePage() {
  const { language, text } = useLanguage()
  const [diagnosis, setDiagnosis] = useState<DiagnosisSession | null>(null)
  const [selectedEvidence, setSelectedEvidence] =
    useState<EvidenceItem | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isReanalyzing, setIsReanalyzing] = useState(false)
  const [isSavingReport, setIsSavingReport] = useState(false)
  const [savedReportId, setSavedReportId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const sessionId = window.sessionStorage.getItem('activeDiagnosisSessionId')
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
          window.sessionStorage.setItem('activeDiagnosisSessionId', onsite.id)
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
    if (!diagnosis?.nextQuestion) return
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
      setErrorMessage(
        error instanceof Error
          ? error.message
          : text('现场信息提交失败，请重试。', '現場情報の送信に失敗しました。'),
      )
    } finally {
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
          </section>

          {diagnosis.nextQuestion ? (
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

      {isReanalyzing && <AnalysisOverlay mode="ONSITE" />}
      {selectedEvidence && (
        <EvidenceDialog
          evidence={selectedEvidence}
          onClose={() => setSelectedEvidence(null)}
        />
      )}
    </main>
  )
}

function OnsiteQuestionPanel({
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

function ReportsPage() {
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

function statusLabel(
  status: DiagnosisSession['status'],
  language: 'zh-CN' | 'ja-JP',
) {
  const japanese = language === 'ja-JP'
  if (status === 'READY') return japanese ? '証拠十分' : '证据充分'
  if (status === 'ONSITE_QUESTIONING')
    return japanese ? '現場確認待ち' : '等待现场确认'
  if (status === 'CONVERGED')
    return japanese ? '現場結論が収束' : '现场结论已收敛'
  if (status === 'PARTIALLY_SUPPORTED')
    return japanese ? '一部支持' : '部分支持'
  return japanese ? '証拠不足' : '证据不足'
}

function fieldValue(
  diagnosis: DiagnosisSession,
  code: string,
  language: 'zh-CN' | 'ja-JP',
) {
  return (
    diagnosis.problemUnderstanding.fields
      .find((field) => field.code === code)
      ?.value?.toString() || (language === 'ja-JP' ? '機器不明' : '未知设备')
  )
}

function formatSavedAt(value: string, language: 'zh-CN' | 'ja-JP') {
  return new Intl.DateTimeFormat(language, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function supportBandLabel(
  supportBand: DiagnosisSession['candidates'][number]['supportBand'],
) {
  if (supportBand === 'STRONG_SUPPORT') return 'HIGH'
  if (supportBand === 'SUPPORTED') return 'MEDIUM'
  return 'REVIEW'
}

export default App
