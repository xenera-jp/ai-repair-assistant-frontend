import {
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Database,
  ExternalLink,
  FileCheck2,
  FileText,
  Gauge,
  History,
  Languages,
  LoaderCircle,
  MessageSquareText,
  PackageCheck,
  Radio,
  Search,
  Save,
  ShieldCheck,
  SkipForward,
  TriangleAlert,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { api } from './api/client'
import type {
  DiagnosisSession,
  EvidenceItem,
  OnsiteQuestionResponse,
  ProblemUnderstanding,
  SavedReport,
  SystemStatus,
} from './api/types'
import './App.css'

const demoQuestion =
  'RIR1-SSB 冷却效果明显下降，背面发热，显示 E4。设备仍在运行，但柜内温度持续升高。'

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
    <div className="app-shell">
      <header className="topbar">
        <AppLink className="brand" to="/pre-departure">
          <span className="brand-mark">AI</span>
          <span>
            <strong>AI 维修助手</strong>
            <small>Repair Intelligence Workspace</small>
          </span>
        </AppLink>

        <nav aria-label="主要导航">
          <AppLink
            className={path === '/pre-departure' ? 'active' : undefined}
            to="/pre-departure"
          >
            出发前分析
          </AppLink>
          <AppLink
            className={path === '/onsite' ? 'active' : undefined}
            to="/onsite"
          >
            现场分析
          </AppLink>
          <AppLink
            className={path === '/reports' ? 'active' : undefined}
            to="/reports"
          >
            诊断报告
          </AppLink>
        </nav>

        <div className="topbar-actions">
          <button className="icon-button" type="button" title="切换语言">
            <Languages size={17} />
          </button>
          <span
            className={`connection-state ${systemStatus ? 'online' : 'offline'}`}
          >
            <Radio size={13} />
            {systemStatus ? systemStatus.knowledgeVersion : '后端未连接'}
          </span>
        </div>
      </header>

      {path === '/pre-departure' && <PreDeparturePage />}
      {path === '/onsite' && <OnsitePage />}
      {path === '/reports' && <ReportsPage />}
    </div>
  )
}

function PreDeparturePage() {
  const [question, setQuestion] = useState(demoQuestion)
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
        language: 'zh-CN',
        originalText: question,
      })
      setUnderstanding(result)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : '问题理解失败，请稍后重试。',
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
        error instanceof Error ? error.message : 'AI 诊断失败，请稍后重试。',
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
        error instanceof Error ? error.message : '报告保存失败，请稍后重试。',
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
          <h1>出发前故障分析</h1>
        </div>
        <p>先把现场描述转化为问题模型，再按设备与故障类型组织企业维修知识。</p>
      </section>

      <section className="workflow" aria-label="诊断流程">
        <div className="workflow-step active">
          <span>01</span>
          <strong>描述问题</strong>
        </div>
        <ChevronRight size={18} />
        <div className={understanding ? 'workflow-step active' : 'workflow-step'}>
          <span>02</span>
          <strong>确认理解</strong>
        </div>
        <ChevronRight size={18} />
        <div className={diagnosis ? 'workflow-step active' : 'workflow-step'}>
          <span>03</span>
          <strong>检索与诊断</strong>
        </div>
      </section>

      <section className="input-band">
        <div className="section-title">
          <BrainCircuit size={19} />
          <div>
            <h2>描述设备问题</h2>
            <p>输入型号、错误码、症状、运行状态，以及已经确认的现场信息。</p>
          </div>
        </div>
        <textarea
          aria-label="故障问题"
          maxLength={4000}
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value)
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
            {isUnderstanding ? '正在理解问题' : '分析问题'}
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
          <strong>等待问题分析</strong>
          <p>系统将优先生成结构化查询，证据不足时再进入语义检索。</p>
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
            <h2>问题理解</h2>
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
              <strong>{field.value?.toString() || '尚未补充'}</strong>
              <span className="field-meta">
                {field.state === 'MISSING'
                  ? field.prompt
                  : `识别可信度 ${Math.round(field.confidence * 100)}%`}
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
          <span>问题分类支持度</span>
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
              强烈建议补充：
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
          {diagnosisReady ? '诊断已完成' : '开始 AI 诊断'}
        </button>
      </aside>
    </section>
  )
}

function AnalysisOverlay({ mode = 'INITIAL' }: { mode?: 'INITIAL' | 'ONSITE' }) {
  const phases =
    mode === 'ONSITE'
      ? [
          ['记录现场事实', '把工程师确认的信息写入现场会话'],
          ['核验候选原因', '根据支持与冲突信号重新计算候选排序'],
          ['更新证据链', '将现场事实与历史维修证据关联'],
          ['判断是否收敛', '决定继续追问或形成现场诊断结论'],
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
        <h2>{mode === 'ONSITE' ? '正在收敛现场结论' : '正在构建可追溯诊断'}</h2>
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
        <h2 id="recommended-title">缺少强推荐信息</h2>
        <p>系统可以继续分析，但以下信息缺失会降低候选排序的区分度。</p>
        <ul>
          {fields.map((field) => (
            <li key={field.code}>{field.prompt || field.label}</li>
          ))}
        </ul>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            返回补充
          </button>
          <button className="primary-button" onClick={onContinue} type="button">
            仍然继续分析
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
          <h2>AI 诊断与决策建议</h2>
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
                  {reportSaved ? '报告已保存' : '保存报告'}
                </button>
              )}
              {onEnterOnsite && (
                <button
                  className="primary-button"
                  onClick={onEnterOnsite}
                  type="button"
                >
                  进入现场分析
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          )}
          <div className="result-stats">
            <span>
              <strong>{candidateCount}</strong>
              候选原因
            </span>
            <span>
              <strong>{evidenceCount}</strong>
              可追溯证据
            </span>
            <span className={`status-${diagnosis.status.toLowerCase()}`}>
              <CheckCircle2 size={14} />
              {statusLabel(diagnosis.status)}
            </span>
          </div>
        </div>
      </header>

      <div className="diagnosis-evidence-grid">
        <section className="candidate-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">POSSIBLE CAUSES</span>
              <h3>候选故障原因</h3>
            </div>
            <span>最多显示 3 项</span>
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
                      {index === 0 && <span className="likely-tag">最可能原因</span>}
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
              <strong>当前证据不足</strong>
              <p>系统没有为了填满页面而生成低可信候选，请补充设备信息或现场现象。</p>
            </div>
          )}
        </section>

        <aside className="evidence-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">TRACEABLE EVIDENCE</span>
              <h3>证据面板</h3>
            </div>
            <ShieldCheck size={19} />
          </div>
          <div className="evidence-groups">
            {diagnosis.evidenceGroups.map((group) => (
              <div className="evidence-group" key={group.type}>
                <h4>
                  {group.type === 'REPAIR_CASE' ? (
                    <History size={15} />
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
                        ? '已验证案例'
                        : item.trustLabel === 'USER_CONFIRMED'
                          ? '现场已确认'
                        : '历史使用记录'}
                    </span>
                    <strong>{item.title}</strong>
                    <p>{item.summary}</p>
                    <span className="open-evidence">
                      查看依据
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
          <h3>备件、工具与维修步骤</h3>
        </div>
        <div className="decision-grid">
          <div className="preparation-column">
            <div className="preparation-block">
              <h4>
                <PackageCheck size={16} />
                推荐备件
              </h4>
              <div className="compact-items">
                {diagnosis.recommendations.parts.length ? (
                  diagnosis.recommendations.parts.map((part) => (
                    <div key={part.partNumber}>
                      <span>{part.name}</span>
                      <strong>{part.partNumber}</strong>
                      <small>
                        {part.preparationLevel === 'RECOMMENDED_PREPARE'
                          ? '建议出发前准备'
                          : '现场确认后使用'}
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="muted-copy">历史记录中暂无稳定备件证据。</p>
                )}
              </div>
            </div>
            <div className="preparation-block">
              <h4>
                <Wrench size={16} />
                所需工具
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
              建议维修步骤
            </h4>
            {diagnosis.recommendations.steps.length ? (
              <ol className="repair-steps">
                {diagnosis.recommendations.steps.map((step) => (
                  <li key={`${step.sequence}-${step.instruction}`}>
                    <span>{String(step.sequence).padStart(2, '0')}</span>
                    <div>
                      <strong>{step.instruction}</strong>
                      <small>来自已解决维修案例</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted-copy">需要更多已验证处置记录后才能生成步骤。</p>
            )}
          </div>
        </div>
      </section>
    </section>
  )
}

function EvidenceDialog({
  evidence,
  onClose,
}: {
  evidence: EvidenceItem
  onClose: () => void
}) {
  return (
    <div className="dialog-backdrop evidence-backdrop" role="presentation">
      <section
        aria-labelledby="evidence-title"
        aria-modal="true"
        className="evidence-dialog"
        role="dialog"
      >
        <header>
          <div>
            <span className="eyebrow">EVIDENCE READER</span>
            <h2 id="evidence-title">{evidence.title}</h2>
          </div>
          <button
            aria-label="关闭证据"
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
              ? '已验证维修结果'
              : evidence.trustLabel === 'USER_CONFIRMED'
                ? '工程师现场确认'
                : '历史备件记录'}
          </span>
          <span>{evidence.id}</span>
        </div>
        <div className="evidence-document">
          <h3>证据摘要</h3>
          <p>{evidence.summary}</p>
          <h3>来源定位</h3>
          <p>{evidence.sourceReference}</p>
        </div>
        <footer>
          <span>命中信号</span>
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

function OnsitePage() {
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
              : '现场诊断会话加载失败，请重新开始出发前分析。',
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
        error instanceof Error ? error.message : '现场信息提交失败，请重试。',
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
        error instanceof Error ? error.message : '报告保存失败，请稍后重试。',
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
          <h1>现场分析</h1>
        </div>
        <p>继承出发前结论，通过一次一个问题继续缩小候选范围。</p>
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
          <strong>正在加载现场会话</strong>
          <p>读取出发前结论与待确认信号。</p>
        </section>
      ) : diagnosis ? (
        <>
          <section className="onsite-context">
            <div>
              <span className="eyebrow">ACTIVE DIAGNOSIS SESSION</span>
              <h2>
                {fieldValue(diagnosis, 'equipmentModel')} ·{' '}
                {diagnosis.problemUnderstanding.primaryProblemType.label}
              </h2>
              <p>{diagnosis.problemUnderstanding.summary}</p>
            </div>
            <div className="session-facts">
              <span>
                <strong>{diagnosis.candidates.length}</strong>
                当前候选
              </span>
              <span>
                <strong>{diagnosis.nextQuestion?.round ?? '—'}</strong>
                现场轮次
              </span>
              <span>
                <strong>{statusLabel(diagnosis.status)}</strong>
                当前状态
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
                    ? '现场结论已收敛'
                    : '本次现场追问已结束'}
                </h2>
                <p>
                  系统已保留全部回答和证据变化。确认无误后，可将当前快照保存为诊断报告。
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
          <strong>没有可继续的诊断会话</strong>
          <p>先完成一次出发前分析，再进入现场确认。</p>
          <AppLink className="inline-link" to="/pre-departure">
            返回出发前分析
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
  const [measurement, setMeasurement] = useState('')
  const [otherText, setOtherText] = useState('')
  const [showOther, setShowOther] = useState(false)

  return (
    <section className="onsite-question">
      <div className="question-index">
        <span>{String(question.round).padStart(2, '0')}</span>
        <small>最多 03 轮</small>
      </div>
      <div className="question-main">
        <span className="eyebrow">NEXT BEST QUESTION</span>
        <h2>{question.prompt}</h2>
        <p>该问题用于区分当前候选原因；回答会进入证据链并触发重新分析。</p>

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
              aria-label="现场测量值"
              inputMode="decimal"
              placeholder="输入测量值"
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
              提交测量
            </button>
          </div>
        )}

        {showOther && (
          <div className="other-entry">
            <input
              aria-label="其他现场观察"
              placeholder="输入现场实际观察"
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
              提交观察
            </button>
          </div>
        )}

        <div className="question-secondary-actions">
          <button
            disabled={disabled}
            onClick={() => setShowOther((current) => !current)}
            type="button"
          >
            <MessageSquareText size={14} />
            其他观察
          </button>
          <button
            disabled={disabled}
            onClick={() => onAnswer({ responseType: 'UNAVAILABLE' })}
            type="button"
          >
            <CircleAlert size={14} />
            无法确认
          </button>
          <button
            disabled={disabled}
            onClick={() => onAnswer({ responseType: 'SKIPPED' })}
            type="button"
          >
            <SkipForward size={14} />
            暂时跳过
          </button>
        </div>
      </div>
      <aside className="question-purpose">
        <span>验证候选</span>
        <strong>
          {question.candidateCode
            .split('_')
            .map((part) => part.toLowerCase())
            .join(' ')}
        </strong>
        <small>信号：{question.signalCode}</small>
      </aside>
    </section>
  )
}

function ReportsPage() {
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
            error instanceof Error ? error.message : '诊断报告加载失败。',
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
          <h1>诊断报告</h1>
        </div>
        <p>这里只保留用户主动保存的诊断结果，避免无效会话堆积。</p>
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
          <strong>正在读取已保存报告</strong>
        </section>
      ) : reports.length ? (
        <section className="reports-layout">
          <aside className="report-list">
            <header>
              <span className="eyebrow">SAVED SNAPSHOTS</span>
              <h2>已保存报告</h2>
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
                      {report.stage === 'ONSITE' ? '现场分析' : '出发前分析'} ·{' '}
                      {formatSavedAt(report.savedAt)}
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
                      报告保存于 {formatSavedAt(selectedReport.savedAt)}，内容为当时诊断会话的不可变快照。
                    </p>
                  </div>
                  <div>
                    <span>{selectedReport.stage === 'ONSITE' ? '现场' : '出发前'}</span>
                    <strong>{statusLabel(selectedReport.diagnosisStatus)}</strong>
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
          <strong>暂无已保存报告</strong>
          <p>完成诊断后点击“保存报告”，这里才会出现记录。</p>
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

function statusLabel(status: DiagnosisSession['status']) {
  if (status === 'READY') return '证据充分'
  if (status === 'ONSITE_QUESTIONING') return '等待现场确认'
  if (status === 'CONVERGED') return '现场结论已收敛'
  if (status === 'PARTIALLY_SUPPORTED') return '部分支持'
  return '证据不足'
}

function fieldValue(diagnosis: DiagnosisSession, code: string) {
  return (
    diagnosis.problemUnderstanding.fields
      .find((field) => field.code === code)
      ?.value?.toString() || '未知设备'
  )
}

function formatSavedAt(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
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
