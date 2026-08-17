import { BrainCircuit, Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n'

/** 在诊断、现场分析或重新分析期间展示不可操作的进度遮罩。 */
export function AnalysisOverlay({ mode = 'INITIAL' }: { mode?: 'INITIAL' | 'ONSITE' | 'ONSITE_REANALYSIS' }) {
  const { language, text } = useLanguage()
  const phases =
    mode === 'ONSITE' || mode === 'ONSITE_REANALYSIS'
      ? language === 'ja-JP'
        ? [
          ['現場事実を記録', '確認された情報を現場セッションに記録しています'],
          ['原因候補を検証', '支持・反証シグナルで候補順位を再計算しています'],
          ['証拠チェーンを更新', '現場事実と過去の修理証拠を関連付けています'],
          ['収束判定', '追加質問または現場結論の確定を判断しています'],
        ]
        : [
          ['记录现场事实', '把工程师确认的信息写入现场会话'],
          ['核验候选原因', '根据支持与冲突信号重新计算候选排序'],
          ['更新证据链', '将现场事实与历史维修证据关联'],
          ['判断是否收敛', '决定继续追问或形成现场诊断结论'],
        ]
      : language === 'ja-JP'
        ? [
          ['問題モデルを解析', '機器、故障分類、検索制約を確認しています'],
          ['保守知識を検索', '同一型式・同一問題カテゴリの解決済み事例を優先検索しています'],
          ['履歴証拠を検証', '修理記録、処置結果、実使用部品を関連付けています'],
          ['診断提案を生成', '証拠の範囲内で原因候補と作業手順を構成しています'],
        ]
        : [
          ['解析问题模型', '确认设备、故障分类与检索约束'],
          ['检索维修知识', '优先匹配同型号、同问题类型的已解决案例'],
          ['核验历史证据', '关联维修记录、处理结果与实际使用备件'],
          ['生成诊断建议', '在证据边界内组织候选原因与行动步骤'],
        ]
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPhaseIndex((current) => Math.min(current + 1, phases.length - 1))
    }, 640)
    return () => window.clearInterval(timer)
  }, [phases.length])

  return (
    <div className="analysis-overlay" role="status" aria-live="polite">
      <div className="analysis-console">
        <div className="analysis-visual" aria-hidden="true">
          <span className="orbit orbit-one" />
          <span className="orbit orbit-two" />
          <span className="analysis-core">
            <BrainCircuit size={30} />
          </span>
          <span className="scan-line" />
        </div>
        <span className="eyebrow">REPAIR INTELLIGENCE ENGINE</span>
        <h2>
          {mode === 'ONSITE' || mode === 'ONSITE_REANALYSIS'
            ? text(
                mode === 'ONSITE_REANALYSIS' ? '正在根据现场发现重新分析' : '正在收敛现场结论',
                mode === 'ONSITE_REANALYSIS' ? '現場での発見に基づき再分析中' : '現場結論を絞り込み中',
              )
            : text('正在构建可追溯诊断', '追跡可能な診断を構築中')}
        </h2>
        <p>{phases[phaseIndex][1]}</p>
        <div className="analysis-phases">
          {phases.map(([title], index) => (
            <div
              className={
                index < phaseIndex
                  ? 'complete'
                  : index === phaseIndex
                    ? 'running'
                    : ''
              }
              key={title}
            >
              <span>{index < phaseIndex ? <Check size={13} /> : index + 1}</span>
              <strong>{title}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
