import { Monitor, Moon, Radio, Sun } from 'lucide-react'
import type { ReactNode } from 'react'

import { useLanguage } from '../../i18n'
import type { AppPath } from '../constant/route'
import { useSystemStatus } from '../hook/useSystemStatus'
import { useTheme } from '../hook/useTheme'
import { AppLink } from './AppLink'

/** 应用公共外壳所需的页面内容和当前路由。 */
interface AppShellProps {
  children: ReactNode
  path: AppPath
}

/** 提供全局导航、语言/主题切换及后端连接状态。 */
export function AppShell({ children, path }: AppShellProps) {
  const systemStatus = useSystemStatus()
  const { activeTheme, setTheme, themePreference } = useTheme()
  const { language, setLanguage, text } = useLanguage()

  return (
    <div className="app-shell" data-theme={activeTheme}>
      <header className="topbar">
        <AppLink className="brand" to="/recordings">
          <span className="brand-mark">AI</span>
          <span>
            <strong>{text('🔋AI 维修助手', '🔋AI 修理アシスタント')}</strong>
            <small>Repair Intelligence Workspace</small>
          </span>
        </AppLink>
        <nav aria-label={text('主要导航', 'メインナビゲーション')}>
          <AppLink className={path === '/recordings' ? 'active' : undefined} to="/recordings">{text('录音分析', '録音分析')}</AppLink>
          <AppLink className={path === '/pre-departure' ? 'active' : undefined} to="/pre-departure">{text('出发前分析', '出発前分析')}</AppLink>
          <AppLink className={path === '/onsite' ? 'active' : undefined} to="/onsite">{text('现场分析', '現場分析')}</AppLink>
          <AppLink className={path === '/reports' ? 'active' : undefined} to="/reports">{text('诊断报告', '診断レポート')}</AppLink>
        </nav>
        <div className="topbar-actions">
          <div aria-label={text('切换语言', '言語切替')} className="language-switch" role="group">
            <button aria-pressed={language === 'zh-CN'} className={language === 'zh-CN' ? 'active' : undefined} onClick={() => setLanguage('zh-CN')} type="button">中</button>
            <button aria-pressed={language === 'ja-JP'} className={language === 'ja-JP' ? 'active' : undefined} onClick={() => setLanguage('ja-JP')} type="button">日</button>
          </div>
          <div aria-label={text('界面主题', '画面テーマ')} className="theme-switch" role="group">
            <button aria-label={text('浅色模式', 'ライトモード')} aria-pressed={themePreference === 'light'} className={themePreference === 'light' ? 'active' : undefined} onClick={() => setTheme('light')} type="button"><Sun size={15} /></button>
            <button aria-label={text('深色模式', 'ダークモード')} aria-pressed={themePreference === 'dark'} className={themePreference === 'dark' ? 'active' : undefined} onClick={() => setTheme('dark')} type="button"><Moon size={15} /></button>
            <button aria-label={text('跟随系统', 'システム設定に合わせる')} aria-pressed={themePreference === 'system'} className={themePreference === 'system' ? 'active' : undefined} onClick={() => setTheme('system')} type="button"><Monitor size={15} /></button>
          </div>
          <span className={`connection-state ${systemStatus ? 'online' : 'offline'}`}><Radio size={13} />{systemStatus ? systemStatus.knowledgeVersion : text('后端未连接', 'バックエンド未接続')}</span>
        </div>
      </header>
      {children}
    </div>
  )
}
