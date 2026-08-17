import { useEffect, useState } from 'react'

import { normalizePath, routes, type AppPath } from '../constant/route'

/** 使用 History API 完成站内跳转，保留浏览器前进/后退行为。 */
export function navigate(path: AppPath) {
  if (window.location.pathname === path) return
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** 订阅当前路径；无效地址会被收敛到出发前分析页。 */
export function useAppRoute() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname))

  useEffect(() => {
    const handleNavigation = () => setPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', handleNavigation)
    if (!routes.has(window.location.pathname as AppPath)) {
      window.history.replaceState({}, '', '/pre-departure')
    }
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])

  return path
}
