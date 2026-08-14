/** 后端健康状态及诊断依赖的配置摘要。 */
export interface SystemStatus {
  /** 提供状态接口的服务名称。 */
  service: string
  /** 服务健康状态；当前前端约定只接受 UP。 */
  status: 'UP'
  /** 当前加载的知识库版本标识。 */
  knowledgeVersion: string
  /** 诊断依赖的外部集成配置状态。 */
  integrations: {
    /** 是否已配置 Qdrant 向量检索服务。 */ qdrantConfigured: boolean
    /** 是否已配置 OpenAI 分析能力。 */ openAiConfigured: boolean
  }
  /** 后端生成此状态快照的 ISO 8601 时间。 */
  timestamp: string
}
