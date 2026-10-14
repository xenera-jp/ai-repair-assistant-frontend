import { AppShell } from './common/component/AppShell'
import { useAppRoute } from './common/hook/useAppRoute'
import { useEffect, useState } from 'react'
import { OnsitePage } from './page/onsite/OnsitePage'
import { PreDeparturePage } from './page/pre-departure/PreDeparturePage'
import { ReportsPage } from './page/report/ReportsPage'
import { RecordingPage } from './page/recording/RecordingPage'
import './App.css'

/** 根据轻量路由渲染业务页面，并统一包裹应用外壳。 */
function App() {
  const path = useAppRoute()
  const [visited, setVisited] = useState(() => new Set([path]))
  useEffect(() => {
    setVisited((current) => current.has(path) ? current : new Set([...current, path]))
  }, [path])
  return (
    <AppShell path={path}>
      {/* Keep visited analysis workspaces mounted so navigation preserves drafts and results. */}
      {(visited.has('/recordings') || path === '/recordings') && (
        <div style={{ display: path === '/recordings' ? 'contents' : 'none' }}>
          <RecordingPage active={path === '/recordings'} />
        </div>
      )}
      {(visited.has('/pre-departure') || path === '/pre-departure') && (
        <div style={{ display: path === '/pre-departure' ? 'contents' : 'none' }}>
          <PreDeparturePage active={path === '/pre-departure'} />
        </div>
      )}
      {path === '/onsite' && <OnsitePage />}
      {path === '/reports' && <ReportsPage />}
    </AppShell>
  )
}

export default App
