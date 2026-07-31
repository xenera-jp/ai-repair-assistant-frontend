import {
  BrainCircuit,
  Check,
  ChevronRight,
  CircleAlert,
  Database,
  FileText,
  Languages,
  LoaderCircle,
  Radio,
  Search,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { useEffect, useState } from 'react'

import { api } from './api/client'
import type { ProblemUnderstanding, SystemStatus } from './api/types'
import { mockProblemUnderstanding } from './mocks/problem-understanding'
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
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const analyze = async () => {
    if (!question.trim()) return
    setIsAnalyzing(true)

    try {
      if (import.meta.env.VITE_USE_MOCKS === 'false') {
        const result = await api.understandProblem({
          stage: 'PRE_DEPARTURE',
          language: 'zh-CN',
          originalText: question,
        })
        setUnderstanding(result)
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, 800))
        setUnderstanding({
          ...mockProblemUnderstanding,
          originalText: question,
        })
      }
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <main>
      <section className="page-heading">
        <div>
          <span className="eyebrow">PRE-DEPARTURE ANALYSIS</span>
          <h1>出发前故障分析</h1>
        </div>
        <p>先理解问题，再决定检索路径。信息不足时由系统引导补充。</p>
      </section>

      <section className="workflow">
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
        <div className="workflow-step">
          <span>03</span>
          <strong>检索与诊断</strong>
        </div>
      </section>

      <section className="input-band">
        <div className="section-title">
          <BrainCircuit size={19} />
          <div>
            <h2>描述设备问题</h2>
            <p>可以输入型号、错误码、症状、发生时间和已确认的现场信息。</p>
          </div>
        </div>
        <textarea
          aria-label="故障问题"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
        <div className="input-actions">
          <span>{question.length} / 4000</span>
          <button
            className="primary-button"
            disabled={!question.trim() || isAnalyzing}
            onClick={analyze}
            type="button"
          >
            {isAnalyzing ? (
              <LoaderCircle className="spin" size={17} />
            ) : (
              <Search size={17} />
            )}
            {isAnalyzing ? '正在理解问题' : '分析问题'}
          </button>
        </div>
      </section>

      {understanding ? (
        <UnderstandingPanel understanding={understanding} />
      ) : (
        <section className="empty-analysis">
          <Database size={28} />
          <strong>等待问题分析</strong>
          <p>系统将优先生成结构化查询，必要时才进入向量检索。</p>
        </section>
      )}
    </main>
  )
}

function UnderstandingPanel({
  understanding,
}: {
  understanding: ProblemUnderstanding
}) {
  const recommendedMissing = understanding.fields.filter(
    (field) => field.level === 'B' && field.state === 'MISSING',
  )

  return (
    <section className="understanding-layout">
      <div className="understanding-main">
        <div className="section-title">
          <Check size={19} />
          <div>
            <h2>AI 已理解</h2>
            <p>{understanding.summary}</p>
          </div>
        </div>

        <div className="field-grid">
          {understanding.fields.map((field) => (
            <div
              className={`understood-field level-${field.level.toLowerCase()}`}
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
          <strong>{understanding.primaryProblemType.supportScore}</strong>
          <span>问题分类支持度</span>
        </div>

        {recommendedMissing.length > 0 && (
          <div className="strong-notice">
            <CircleAlert size={17} />
            <p>
              强烈建议补充：
              {recommendedMissing.map((field) => field.prompt).join(' ')}
            </p>
          </div>
        )}

        <button className="primary-button wide" type="button">
          <ShieldCheck size={17} />
          开始 AI 诊断
        </button>
      </aside>
    </section>
  )
}

function OnsitePage() {
  return (
    <main>
      <section className="page-heading">
        <div>
          <span className="eyebrow">ONSITE REFINEMENT</span>
          <h1>现场分析</h1>
        </div>
        <p>继承出发前结论，通过一次一个问题继续缩小候选范围。</p>
      </section>
      <section className="placeholder-grid">
        <div>
          <Wrench size={24} />
          <h2>等待选择诊断会话</h2>
          <p>进入现场后，系统会根据当前候选生成最有区分度的问题。</p>
        </div>
        <div className="question-preview">
          <span className="eyebrow">NEXT QUESTION</span>
          <strong>现场确认问题将在这里显示</strong>
          <p>支持标准选项、测量值、无法确认、其他和暂时跳过。</p>
        </div>
      </section>
    </main>
  )
}

function ReportsPage() {
  return (
    <main>
      <section className="page-heading">
        <div>
          <span className="eyebrow">SAVED REPORTS</span>
          <h1>诊断报告</h1>
        </div>
        <p>这里只保留用户主动保存的诊断结果，避免无效会话堆积。</p>
      </section>
      <section className="empty-analysis">
        <FileText size={28} />
        <strong>暂无已保存报告</strong>
        <p>诊断完成后点击“保存报告”，系统会保留不可变版本快照。</p>
      </section>
    </main>
  )
}

export default App
