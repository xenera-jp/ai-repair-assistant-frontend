import { apiUrl } from './client'

/** 知识库资源接口，目前用于获取可在浏览器中打开的手册地址。 */
export const knowledgeApi = {
  manualDocumentUrl: (manualKnowledgeId: number) => apiUrl(`/api/v1/knowledge/manuals/${manualKnowledgeId}/document`),
}
