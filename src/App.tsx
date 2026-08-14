import { AppShell } from './common/component/AppShell'
import { useAppRoute } from './common/hook/useAppRoute'
import { useLanguage } from './i18n'
import { OnsitePage } from './page/onsite/OnsitePage'
import { PreDeparturePage } from './page/pre-departure/PreDeparturePage'
import { ReportsPage } from './page/report/ReportsPage'
import './App.css'

/** 根据轻量路由渲染业务页面，并统一包裹应用外壳。 */
function App() {
  const path = useAppRoute()
  const { language } = useLanguage()
  return (
    <AppShell path={path}>
      {path === '/pre-departure' && <PreDeparturePage key={language} />}
      {path === '/onsite' && <OnsitePage key={language} />}
      {path === '/reports' && <ReportsPage key={language} />}
    </AppShell>
  )
}

export default App
