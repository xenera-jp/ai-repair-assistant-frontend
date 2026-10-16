import { useEffect, useState } from 'react'
import { getModelCosts, type ModelCostSummary } from '../../api/model-cost-api'
import { useLanguage } from '../../i18n'
import './model-cost.css'
import { usdJpyRate, formatYen } from './currency'

export function ModelCostPanel({ scope, active = true }: { scope?: string | null; active?: boolean }) {
  const { text } = useLanguage()
  const [result, setResult] = useState<{ scope: string; data: ModelCostSummary } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!scope || !active) return
    let disposed = false
    const controller = new AbortController()
    let timer: number | undefined
    const load = async () => {
      try {
        const data = await getModelCosts(scope, controller.signal)
        if (!disposed) { setResult({ scope, data }); setFailed(false) }
      } catch { if (!disposed) setFailed(true) }
      finally { if (!disposed) timer = window.setTimeout(() => void load(), 4000) }
    }
    void load()
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer) }
  }, [scope, active])
  if (!scope) return null
  const data = result?.scope === scope ? result.data : null
  const displayedUsd = data?.withoutSpeakerProcessingUsd
  const yen = displayedUsd == null ? '—' : formatYen(displayedUsd)
  return <section className="model-cost-panel" aria-label={text('模型费用', 'モデル費用')} title={text('本次工作累计费用，含重复调用；仅统计 OpenAI', '今回の累計費用・再実行を含む・OpenAIのみ')}>
    <div className="model-cost-totals">
      <span className="model-cost-label">{text('模型费用', 'モデル費用')}</span>
      <span title={text(`参考汇率：1 美元 = ${usdJpyRate} 日元，非实时汇率`, `参考レート：1 USD = ${usdJpyRate} 円（リアルタイムではありません）`)}>{text('约合', '約')} <strong>¥{yen}</strong> {text('日元', '円')}</span>
    </div>
    {failed && <small className="model-cost-notice" role="status">{text('费用读取失败，正在重试', '費用取得失敗・再試行中')}</small>}
    {data && (data.unpricedCalls > 0 || data.estimatedCalls > 0) && <small className="model-cost-notice">{text(`含 ${data.estimatedCalls} 次估算 · ${data.unpricedCalls} 次待核算`, `概算 ${data.estimatedCalls} 件・未計算 ${data.unpricedCalls} 件`)}</small>}
  </section>
}
