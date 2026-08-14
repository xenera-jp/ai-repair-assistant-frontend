import { diagnosisApi } from './diagnosis-api'
import { knowledgeApi } from './knowledge-api'
import { reportApi } from './report-api'
import { systemApi } from './system-api'

// 过渡聚合层：页面拆分完成前保留统一调用方式，新增代码优先导入具体 API 模块。
export const api = { ...diagnosisApi, ...knowledgeApi, ...reportApi, ...systemApi }

export { diagnosisApi, knowledgeApi, reportApi, systemApi }
