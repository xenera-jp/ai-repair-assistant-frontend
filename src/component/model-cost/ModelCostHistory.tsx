import { ReceiptText } from 'lucide-react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { readWorkspace, writeWorkspace } from '../../common/storage/workspace-storage'
import { useEffect, useId, useRef, useState } from 'react'
import { getModelCostHistory, type ModelCostHistoryEntry } from '../../api/model-cost-api'
import { useLanguage } from '../../i18n'
import { formatYen, usdJpyRate } from './currency'
import './model-cost-history.css'

interface Position { x: number; y: number }
const positionKey = 'model-cost-history-position-v1'
function constrain(point: Position): Position {
  return { x: Math.max(12, Math.min(point.x, window.innerWidth - 60)), y: Math.max(12, Math.min(point.y, window.innerHeight - 60)) }
}
export function ModelCostHistory() {
  const { text } = useLanguage()
  const panelId = useId()
  const root = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<number | undefined>(undefined)
  const closeTimer = useRef<number | undefined>(undefined)
  const [position, setPosition] = useState(() => {
    const saved = readWorkspace<Position>(positionKey)
    return constrain(saved && Number.isFinite(saved.x) && Number.isFinite(saved.y) ? saved : { x: window.innerWidth - 72, y: window.innerHeight - 72 })
  })
  const positionRef = useRef(position)
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointerId: number; x: number; y: number; origin: Position; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const move = (next: Position) => { positionRef.current = next; setPosition(next) }
  useEffect(() => {
    const resize = () => {
      const next = constrain(positionRef.current)
      positionRef.current = next; setPosition(next)
      setViewport({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<ModelCostHistoryEntry[] | null>(null)
  const [failed, setFailed] = useState(false)
  const clearTimers = () => { window.clearTimeout(hoverTimer.current); window.clearTimeout(closeTimer.current) }
  useEffect(() => () => { window.clearTimeout(hoverTimer.current); window.clearTimeout(closeTimer.current) }, [])
  useEffect(() => {
    if (!open) return
    let disposed = false
    let timer: number | undefined
    const controller = new AbortController()
    const load = async () => {
      try {
        const result = await getModelCostHistory(controller.signal)
        if (!disposed) { setEntries(result.filter((entry) => entry.functionCode === 'TOTAL').sort((a, b) => b.createdAt.localeCompare(a.createdAt))); setFailed(false) }
      } catch { if (!disposed) setFailed(true) }
      finally { if (!disposed) timer = window.setTimeout(() => void load(), 5000) }
    }
    void load()
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => { disposed = true; controller.abort(); window.clearTimeout(timer); document.removeEventListener('pointerdown', dismiss) }
  }, [open])
  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return
    const moved = drag.current.moved
    drag.current = null; setDragging(false); suppressClick.current = moved
    if (moved) writeWorkspace(positionKey, positionRef.current)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const panelWidth = Math.min(340, viewport.width - 32)
  const panelLeft = Math.max(16, Math.min(position.x + 48 - panelWidth, viewport.width - panelWidth - 16))
  const above = position.y > viewport.height / 2
  const availableHeight = Math.max(80, above ? position.y - 24 : viewport.height - position.y - 84)
  return <div className="model-cost-float" ref={root} style={{ left: position.x, top: position.y }}
    onMouseEnter={() => { clearTimers(); if (!drag.current) hoverTimer.current = window.setTimeout(() => { if (!drag.current) setOpen(true) }, 700) }}
    onMouseLeave={() => { clearTimers(); closeTimer.current = window.setTimeout(() => setOpen(false), 200) }}
    onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) { clearTimers(); setOpen(false) } }}
    onKeyDown={(event) => { if (event.key === 'Escape') { clearTimers(); setOpen(false); root.current?.querySelector('button')?.focus(); clearTimers() } }}>
    {open && <section className="model-cost-history" style={{ left: panelLeft, width: panelWidth, maxHeight: availableHeight, ...(above ? { bottom: viewport.height - position.y + 12 } : { top: position.y + 60 }) }} id={panelId} role="region" aria-label={text('花费历史', '費用履歴')} tabIndex={0}>
      <header><strong>{text('花费历史', '費用履歴')}</strong><small>{text('最近 20 个流程', '直近20フロー')}</small></header>
      <p className="model-cost-history-rate" title={text('参考汇率，非实时汇率', '参考レート・リアルタイムではありません')}>1 USD ≈ {usdJpyRate} JPY</p>
      {failed && <p className="model-cost-history-message" role="status">{text('读取失败，正在重试', '取得失敗・再試行中')}</p>}
      {entries === null && !failed && <p className="model-cost-history-message" role="status">{text('正在读取…', '読み込み中…')}</p>}
      {entries?.length === 0 && <p className="model-cost-history-message">{text('暂无花费记录', '費用記録はありません')}</p>}
      {entries && entries.length > 0 && <div className="model-cost-history-list"><table>
        <thead><tr><th>{text('时间', '日時')}</th><th>{text('日元花费', '費用（円）')}</th></tr></thead>
        <tbody>{entries.map((entry) => <tr key={entry.id}>
          <td><time dateTime={entry.createdAt.replace(' ', 'T')}>{entry.createdAt.replace('T', ' ').split('.')[0]}</time></td>
          <td title={entry.status === 'INCOMPLETE' ? text('包含待核算调用，显示已知费用', '未計算の呼び出しがあり、判明分を表示しています') : entry.status === 'ESTIMATED' ? text('按时长估算', '時間による概算') : undefined}>{entry.costUsd == null ? text('待核算', '未計算') : `${entry.status === 'INCOMPLETE' ? '≥' : '≈'} ¥${formatYen(entry.costUsd)}`}</td>
        </tr>)}</tbody>
      </table></div>}
    </section>}
    <button type="button" className={`model-cost-trigger${dragging ? ' is-dragging' : ''}`} title={text('花费历史 · 可拖动换位', '費用履歴・ドラッグで移動')} aria-label={text('查看花费历史，可拖动换位', '費用履歴を表示・ドラッグで移動可能')} aria-expanded={open} aria-controls={open ? panelId : undefined}
      onFocus={() => { clearTimers(); hoverTimer.current = window.setTimeout(() => { if (!drag.current) setOpen(true) }, 700) }}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return
        clearTimers(); suppressClick.current = false
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, origin: positionRef.current, moved: false }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const current = drag.current
        if (!current || current.pointerId !== event.pointerId) return
        const dx = event.clientX - current.x, dy = event.clientY - current.y
        if (!current.moved && Math.hypot(dx, dy) < 6) return
        current.moved = true; clearTimers(); setDragging(true); setOpen(false)
        move(constrain({ x: current.origin.x + dx, y: current.origin.y + dy }))
      }}
      onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}
      onClick={() => { clearTimers(); if (suppressClick.current) { suppressClick.current = false; return }; setOpen((current) => !current) }}><ReceiptText size={23} aria-hidden="true" /></button>
  </div>
}
