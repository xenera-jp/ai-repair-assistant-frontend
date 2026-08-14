import type { ReactNode } from 'react'

import type { AppPath } from '../constant/route'
import { navigate } from '../hook/useAppRoute'

/** 保留原生链接语义，同时拦截普通点击以完成无刷新导航。 */
export function AppLink({ children, className, to }: { children: ReactNode; className?: string; to: AppPath }) {
  return <a className={className} href={to} onClick={(event) => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault()
      navigate(to)
    }
  }}>{children}</a>
}
