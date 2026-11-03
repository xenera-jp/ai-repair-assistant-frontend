import { useEffect, useState } from 'react'

import { appUrl, routePath } from '../urls'
import { normalizePath, routes, type AppPath } from '../constant/route'

/** 使用 History API 完成站内跳转，保留浏览器前进/后退行为。 */
export function navigate(path: AppPath, state: unknown = {}) {
  const url = appUrl(path)
  if (window.location.pathname === url) return
  window.history.pushState(state, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** 订阅当前路径；无效地址会被收敛到录音分析页。 */
export function useAppRoute() {
  const [path, setPath] = useState(() => normalizePath(routePath(window.location.pathname)))

  useEffect(() => {
    const handleNavigation = () => {
      const current = routePath(window.location.pathname)
      const normalized = normalizePath(current)
      if (!routes.has(current as AppPath)) window.history.replaceState(window.history.state, '', appUrl(normalized) + window.location.search + window.location.hash)
      setPath(normalized)
    }
    window.addEventListener('popstate', handleNavigation)
    handleNavigation()
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  return path
}
