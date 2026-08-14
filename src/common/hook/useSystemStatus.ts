import { useEffect, useState } from 'react'

import { systemApi } from '../../api'
import type { SystemStatus } from '../../model'

/** 在应用壳挂载时读取一次后端状态；失败时以离线状态降级展示。 */
export function useSystemStatus() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  useEffect(() => {
    systemApi.getSystemStatus().then(setSystemStatus).catch(() => setSystemStatus(null))
  }, [])
  return systemStatus
}
