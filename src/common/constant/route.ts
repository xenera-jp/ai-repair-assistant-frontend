/** 应用支持的一级路由，供导航组件和页面分发共同约束。 */
export type AppPath = '/pre-departure' | '/onsite' | '/reports'

/** 允许直接访问的路由白名单。 */
export const routes = new Set<AppPath>(['/pre-departure', '/onsite', '/reports'])

/** 将未知路径归一为默认的出发前分析页。 */
export function normalizePath(pathname: string): AppPath {
  return routes.has(pathname as AppPath) ? (pathname as AppPath) : '/pre-departure'
}
