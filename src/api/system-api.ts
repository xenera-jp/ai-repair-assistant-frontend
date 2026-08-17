import { request } from './client'
import type { SystemStatus } from '../model'

/** 系统健康状态接口，供应用壳展示连接和知识库版本。 */
export const systemApi = {
  getSystemStatus: () => request<SystemStatus>('/api/v1/system/status', { method: 'GET' }),
}
