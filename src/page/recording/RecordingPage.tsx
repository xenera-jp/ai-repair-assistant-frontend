import { FileAudio, LoaderCircle, Mic2, Square, Pencil, Play, RotateCcw, Search, Send, Trash2, Upload, Volume2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { recordingApi } from '../../api'
import { useLanguage } from '../../i18n'
import type { ExtractedIssue, RecordingBatch, RecordingEvidence, SpeakerRole, TranscriptSegment } from '../../model'
import { RealtimePlayback } from './RealtimePlayback'

const terminal = new Set(['PREPARED', 'TRANSCRIBED', 'PARTIAL_SUCCESS', 'REVIEW_REQUIRED', 'READY', 'EXTRACTION_FAILED', 'DIARIZATION_FAILED', 'FAILED'])
const roleValues: SpeakerRole[] = ['UNKNOWN', 'CUSTOMER_SERVICE', 'CUSTOMER', 'FIELD_ENGINEER', 'OTHER']
const issueOrder = ['MODEL', 'SYMPTOM', 'ERROR_CODE', 'OPERATING_STATUS', 'OCCURRENCE', 'MEASUREMENT', 'ENVIRONMENT', 'RECENT_CHANGES', 'PHOTO_EVIDENCE']

export function RecordingPage() {
  const { language, text } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({})
  const transcriptSegmentRefs = useRef<Record<string, HTMLElement | null>>({})
  const uploadController = useRef<AbortController | null>(null)
  const operationVersion = useRef(0)
  const realtimePlayback = useRef<RealtimePlayback | null>(null)
  const [isStartingRealtime, setIsStartingRealtime] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [batch, setBatch] = useState<RecordingBatch | null>(null)
  const [activeFileId, setActiveFileId] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [dismissedIssueTypes, setDismissedIssueTypes] = useState<string[]>([])
  const [evidenceIssue, setEvidenceIssue] = useState<ExtractedIssue | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [streamDrafts, setStreamDrafts] = useState<Record<string, string>>({})
  const [playbackState, setPlaybackState] = useState<'NOT_READY' | 'READY' | 'PLAYING' | 'PAUSED' | 'ENDED'>('NOT_READY')
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const pollingBatchId = batch?.id
  const pollingStatus = batch?.status
  useEffect(() => {
    if (pollingStatus === 'DIARIZATION_FAILED') realtimePlayback.current?.pause()
  }, [pollingStatus])

  useEffect(() => () => { realtimePlayback.current?.dispose(true); uploadController.current?.abort() }, [])

  useEffect(() => {
    const interrupt = () => realtimePlayback.current?.dispose(true)
    window.addEventListener('pagehide', interrupt)
    return () => window.removeEventListener('pagehide', interrupt)
  }, [])

  useEffect(() => {
    const historyState = window.history.state as { recordingBatchId?: unknown; focusRecordingEditor?: unknown } | null
    const batchId = typeof historyState?.recordingBatchId === 'string' ? historyState.recordingBatchId : null
    const focusRecordingEditor = historyState?.focusRecordingEditor === true
    if (!batchId) return
    window.history.replaceState({}, '', window.location.pathname)
    void recordingApi.getBatch(batchId).then((next) => {
      setBatch(next)
      setActiveFileId(next.files[0]?.id ?? '')
      if (focusRecordingEditor) {
        window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
          document.getElementById('recording-issue-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }))
      }
    }).catch((reason) => setError(message(reason, text)))
  }, [text])

  useEffect(() => {
    if (!pollingBatchId || !pollingStatus || terminal.has(pollingStatus)) return
    const id = window.setInterval(() => {
      void recordingApi.getBatch(pollingBatchId).then((next) => {
        setBatch((current) => current?.id === pollingBatchId ? next : current)
        if (!activeFileId && next.files[0]) setActiveFileId(next.files[0].id)
      }).catch((reason) => setBatch((current) => {
        if (current?.id === pollingBatchId) setError(message(reason, text))
        return current
      }))
    }, 2000)
    return () => window.clearInterval(id)
  }, [pollingBatchId, pollingStatus, activeFileId, text])

  useEffect(() => {
    if (!pollingBatchId || !isTranscriptionStatus(pollingStatus)) return
    const events = new EventSource(recordingApi.transcriptionStreamUrl(pollingBatchId))
    events.addEventListener('batch', (event) => {
      const next = JSON.parse((event as MessageEvent<string>).data) as RecordingBatch
      setBatch((current) => {
        if (!current || current.id !== next.id) return current
        const completedFiles = new Set(next.files.filter((file) => {
          const previous = current.files.find((item) => item.id === file.id)
          return !file.realtime && previous != null && file.segments.length > previous.segments.length
        }).map((file) => file.id))
        if (completedFiles.size) setStreamDrafts((drafts) => Object.fromEntries(Object.entries(drafts).filter(([key]) => !completedFiles.has(key.split(':', 1)[0]))))
        return next
      })
      if (!activeFileId && next.files[0]) setActiveFileId(next.files[0].id)
    })
    events.addEventListener('delta', (event) => {
      const delta = JSON.parse((event as MessageEvent<string>).data) as { fileId: string; segmentId: string; delta: string }
      const key = `${delta.fileId}:${delta.segmentId}`
      setStreamDrafts((current) => ({ ...current, [key]: `${current[key] ?? ''}${delta.delta}` }))
    })
    events.addEventListener('draft', (event) => {
      const draft = JSON.parse((event as MessageEvent<string>).data) as { fileId: string; segmentId: string; text: string }
      setStreamDrafts((current) => ({ ...current, [`${draft.fileId}:${draft.segmentId}`]: draft.text }))
    })
    events.addEventListener('transcript-final', (event) => {
      const final = JSON.parse((event as MessageEvent<string>).data) as { fileId: string; segmentId: string }
      setStreamDrafts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => key !== `${final.fileId}:${final.segmentId}`)))
    })
    events.addEventListener('resource-deleted', (event) => {
      const removed = JSON.parse((event as MessageEvent<string>).data) as { fileId: string }
      if (removed.fileId === activeFileId) resetRecording()
    })
    return () => events.close()
  }, [pollingBatchId, pollingStatus, activeFileId])

  const activeFile = batch?.files.find((file) => file.id === activeFileId) ?? batch?.files[0]
  const displayedSegments = useMemo(() => {
    const sorted = [...(activeFile?.segments ?? [])].sort((a, b) => a.startMs - b.startMs)
    return groupConsecutiveSpeakerSegments(sorted)
  }, [activeFile?.segments])
  const activeSegmentId = useMemo(() => displayedSegments.find((segment) => segment.startMs <= currentTimeMs && currentTimeMs < segment.endMs)?.id ?? '', [displayedSegments, currentTimeMs])
  const playbackSegmentId = activeSegmentId || displayedSegments.find((segment) => segment.endMs > currentTimeMs)?.id || ''
  const activeDrafts = activeFile ? Object.entries(streamDrafts).filter(([key]) => key.startsWith(`${activeFile.id}:`)).map(([, value]) => value).filter(Boolean) : []
  const isTranscribing = batch != null && batch.files.some((file) => ['UPLOADED', 'TRANSCRIBING', 'REALTIME_TRANSCRIBING', 'DIARIZATION_FAILED'].includes(file.status))
  const isExtracting = batch?.status === 'EXTRACTING'
  const canSummarize = batch != null && ['TRANSCRIBED', 'PARTIAL_SUCCESS'].includes(batch.status) && batch.files.some((file) => file.status === 'COMPLETED' && file.segments.length > 0)
  useEffect(() => {
    if (pollingStatus && ['TRANSCRIBED', 'PARTIAL_SUCCESS', 'FAILED'].includes(pollingStatus)) setStreamDrafts({})
  }, [pollingStatus])
  const showExtractedIssues = batch != null && ['REVIEW_REQUIRED', 'READY', 'EXTRACTION_FAILED'].includes(batch.status)
  const previewIssues = useMemo(() => (batch?.issues ?? []).map((issue) => issue.correction?.status === 'LLM_PENDING_CONFIRMATION' && issue.correction.suggestedValue ? { ...issue, content: issue.correction.suggestedValue } : issue), [batch?.issues])
  const preview = useMemo(() => compose(previewIssues, language), [previewIssues, language])
  const hasDeviceModel = previewIssues.some((issue) => !issue.deleted && issue.type === 'MODEL' && Boolean(trimTerminalPunctuation(issue.content)))
  const pendingCorrections = batch?.issues.filter((issue) => ['LLM_PENDING_CONFIRMATION', 'MANUAL_INPUT_REQUIRED'].includes(issue.correction?.status ?? '')) ?? []
  const suggestedCorrections = pendingCorrections.filter((issue) => issue.correction?.status === 'LLM_PENDING_CONFIRMATION')
  const hasManualCorrections = pendingCorrections.some((issue) => issue.correction?.status === 'MANUAL_INPUT_REQUIRED')
  const issueGroups = useMemo(() => issueOrder.filter((type) => !dismissedIssueTypes.includes(type)).map((type) => ({ type, issues: (batch?.issues ?? []).filter((issue) => canonicalIssueType(issue.type) === type) })), [batch?.issues, dismissedIssueTypes])

  useEffect(() => {
    if (playbackState !== 'PLAYING' || !playbackSegmentId) return
    transcriptSegmentRefs.current[playbackSegmentId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [playbackSegmentId, playbackState])

  const resetRecording = () => {
    realtimePlayback.current?.dispose(true); realtimePlayback.current = null
    Object.values(audioRefs.current).forEach((audio) => audio?.pause())
    setBatch(null); setActiveFileId(''); setPendingFile(null); setStreamDrafts({})
    transcriptSegmentRefs.current = {}
    setPlaybackState('NOT_READY'); setCurrentTimeMs(0)
    if (inputRef.current) inputRef.current.value = ''
  }

  const upload = async (file: File) => {
    const version = ++operationVersion.current
    const controller = new AbortController()
    uploadController.current = controller
    setPendingFile(file)
    setIsUploading(true); setError(null)
    try {
      const next = await recordingApi.createBatch(file, language, controller.signal)
      if (version !== operationVersion.current) {
        const staleFileId = next.files[0]?.id
        if (staleFileId) void recordingApi.deleteFile(staleFileId)
        return
      }
      setBatch(next); setActiveFileId(next.files[0]?.id ?? ''); setPendingFile(null)
      transcriptSegmentRefs.current = {}
       setPlaybackState('NOT_READY'); setCurrentTimeMs(0)
    } catch (reason) {
      if (!controller.signal.aborted && version === operationVersion.current) setError(message(reason, text))
    } finally {
      if (version === operationVersion.current) setIsUploading(false)
      if (uploadController.current === controller) uploadController.current = null
    }
  }

  const addFiles = async (files: FileList | File[]) => {
    if (isUploading) { setError(text('当前录音仍在上传，请先等待或取消上传。', '現在の録音をアップロード中です。完了を待つか、アップロードをキャンセルしてください。')); return }
    const selected = Array.from(files)
    if (selected.length !== 1) { setError(text('一次只能上传一个录音文件。', '一度にアップロードできる録音ファイルは1件のみです。')); return }
    const file = selected[0]
    if (!/\.(flac|mp3|mp4|mpeg|mpga|m4a|ogg|wav|webm)$/i.test(file.name)) { setError(text('不支持该文件格式。', 'このファイル形式には対応していません。')); return }
    if (batch?.files[0] && !window.confirm(text('上传新录音前需要删除当前录音，是否继续？', '新しい録音をアップロードする前に現在の録音を削除します。続行しますか？'))) return
    if (batch?.files[0]) {
      try { await recordingApi.deleteFile(batch.files[0].id) } catch (reason) { setError(message(reason, text)); return }
      resetRecording()
    }
    await upload(file)
  }

  const deleteRecording = async () => {
    const fileId = activeFile?.id
    if (!fileId || !window.confirm(text('删除后录音和转写内容将从页面移除，是否继续？', '削除すると録音と文字起こしが画面から消えます。続行しますか？'))) return
    operationVersion.current += 1
    uploadController.current?.abort()
    realtimePlayback.current?.dispose(true); realtimePlayback.current = null
    Object.values(audioRefs.current).forEach((audio) => audio?.pause())
    setError(null)
    try { await recordingApi.deleteFile(fileId); resetRecording() } catch (reason) { setError(message(reason, text)) }
  }

  const togglePlayback = async () => {
    if (!activeFile) return
    const audio = audioRefs.current[activeFile.id]
    if (!audio) return
    if (activeFile.realtime) {
      if (isStartingRealtime || playbackState === 'ENDED') return
      if (realtimePlayback.current) {
        try { await realtimePlayback.current.resume() } catch (reason) { setError(message(reason, text)) }
        return
      }
      setIsStartingRealtime(true); setError(null); setStreamDrafts({}); setPlaybackState('READY')
      const engine = new RealtimePlayback(audio, activeFile.id,
        (next) => setBatch((current) => current?.id === next.id ? next : current),
        (detail) => { setError(message(new Error(detail), text)); setPlaybackState('PAUSED') },
        () => {})
      realtimePlayback.current = engine
      try { await engine.start() } catch (reason) { engine.dispose(); realtimePlayback.current = null; setError(message(reason, text)) }
      finally { setIsStartingRealtime(false) }
      return
    }
    if (playbackState === 'PLAYING') { audio.pause(); return }
    if (playbackState === 'ENDED') audio.currentTime = 0
    setPlaybackState('READY')
    void audio.play().catch((reason) => setError(message(reason, text)))
  }

  const endPlayback = async () => {
    if (!activeFile) return
    const audio = audioRefs.current[activeFile.id]
    audio?.pause()
    setPlaybackState('ENDED')
    if (activeFile.realtime) await realtimePlayback.current?.finish()
  }

  const updateBatch = async (operation: () => Promise<RecordingBatch>) => {
    setError(null)
    try { setBatch(await operation()) } catch (reason) { setError(message(reason, text)) }
  }

  const summarize = async () => {
    if (!batch || !canSummarize || isSummarizing) return
    setIsSummarizing(true)
    try { await updateBatch(() => recordingApi.retryExtraction(batch.id, batch.conversationVersion)) }
    finally { setIsSummarizing(false) }
  }

  const apply = async () => {
    if (!batch || !preview || !hasDeviceModel) return
    setIsApplying(true); setError(null)
    try {
      if (suggestedCorrections.length) {
        const confirmed = await recordingApi.confirmCorrections(batch.id, suggestedCorrections.map((issue) => ({ issueId: issue.id, version: issue.version, decision: 'ACCEPT' })))
        setBatch(confirmed)
      }
      window.history.pushState({ recordingProblemDescription: preview, recordingBatchId: batch.id }, '', '/pre-departure')
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (reason) { setError(message(reason, text)); setIsApplying(false) }
  }

  const playEvidence = (evidence: RecordingEvidence) => {
    if (activeFile?.realtime && realtimePlayback.current) {
      void realtimePlayback.current.playEvidence(evidence.startMs).catch((reason) => setError(message(reason, text)))
      return
    }
    const audio = audioRefs.current[evidence.fileId]
    if (!audio) return
    audio.currentTime = evidence.startMs / 1000
    void audio.play()
  }

  return (
    <main className="recording-page" data-extraction-visible={showExtractedIssues}>
      <section className="page-heading">
        <div><span className="eyebrow">RECORDING ANALYSIS</span><h1>{text('录音分析', '録音分析')}</h1></div>
        <p>{text('上传报修录音，核对说话人原文和设备问题后进入诊断。', '録音をアップロードし、話者別の原文と機器情報を確認して診断へ進みます。')}</p>
      </section>

      <section className="recording-card recording-upload">
        <div className="section-title"><Upload size={19}/><div><h2>{text('上传录音文件', '録音ファイルをアップロード')}</h2><p>{text('实时模拟按播放进度识别，完成后点击对话总结提取设备信息。', 'リアルタイムデモは再生に合わせて認識します。完了後「会話の要約」で機器情報を抽出します。')}</p></div></div>
        <button className="recording-dropzone" disabled={isUploading} onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); if (!isUploading) void addFiles(event.dataTransfer.files) }} type="button">
          <Mic2 size={32}/><strong>{text('点击选择或拖入录音', 'クリックまたはドラッグして録音を選択')}</strong><span>FLAC / MP3 / MP4 / M4A / OGG / WAV / WEBM</span>
        </button>
        <input ref={inputRef} hidden accept="audio/*,.mp4,.mpeg,.mpga" type="file" onChange={(event) => event.target.files && void addFiles(event.target.files)}/>
        {pendingFile && <div className="pending-recording-list"><PendingRecording file={pendingFile} onRemove={() => { operationVersion.current += 1; uploadController.current?.abort(); resetRecording(); setIsUploading(false) }} removeLabel={text('取消上传', 'アップロードをキャンセル')}/></div>}
        <div className="recording-actions"><small>{text('上传仅做准备，点击开始播放才发送音频。', 'アップロードは準備のみです。再生開始後に音声を送信します。')}</small>{isUploading && <span className="recording-uploading"><LoaderCircle className="spin" size={17}/>{text('正在上传', 'アップロード中')}</span>}</div>
      </section>

      {error && <div className="error-notice" role="alert">{error}</div>}

      {batch && <>
        <section className="recording-card">
          <div className="section-title"><FileAudio size={19}/><div><h2>{text('录音文件', '録音ファイル')}</h2><p>{statusText(batch.status, text)} · {batch.files.length} {text('个文件', 'ファイル')}</p></div></div>
          <div className="recording-file-list">{batch.files.map((file) => <div className="recording-file" key={file.id}>
            <div className="recording-file-meta"><strong>{file.name}</strong><div className="recording-file-details"><span>{formatBytes(file.sizeBytes)}</span><span aria-live="polite" className={`recording-file-status${file.status === 'TRANSCRIBING' ? ' transcribing' : ''}`} role="status">{file.status === 'TRANSCRIBING' && <LoaderCircle className="spin" size={15} aria-hidden="true"/>}{fileStatus(file.status, text)}</span></div>{file.errorMessage && <small>{file.errorMessage}</small>}</div>
            <div className="recording-audio-controls"><div className="recording-player"><audio crossOrigin="anonymous" controls={!file.realtime || file.status === 'COMPLETED'} preload="metadata" ref={(node) => { audioRefs.current[file.id] = node }} src={recordingApi.audioUrl(file.id)} onLoadedMetadata={() => setPlaybackState('READY')} onPlay={() => setPlaybackState('PLAYING')} onPause={() => { setPlaybackState((current) => current === 'ENDED' ? current : 'PAUSED') }} onEnded={() => { if (!file.realtime || file.status === 'COMPLETED') setPlaybackState('ENDED'); else void endPlayback() }} onTimeUpdate={(event) => setCurrentTimeMs(Math.round(event.currentTarget.currentTime * 1000))} onSeeked={(event) => setCurrentTimeMs(Math.round(event.currentTarget.currentTime * 1000))}/>{file.realtime && file.status !== 'COMPLETED' && <span aria-live="off">{formatTime(currentTimeMs)}</span>}{(!file.realtime || file.status === 'COMPLETED') && <RecordingVolume getAudio={() => audioRefs.current[file.id]} label={text('音量', '音量')}/>}</div><button aria-label={text('删除录音', '録音を削除')} className="recording-delete-button" onClick={() => void deleteRecording()} title={text('删除', '削除')} type="button"><Trash2 size={16}/></button></div>
            <div className="recording-file-actions">
              {(file.realtime ? file.status === 'PREPARED' : playbackState !== 'PLAYING') && <button className="primary-button" disabled={playbackState === 'NOT_READY' || isStartingRealtime} onClick={() => void togglePlayback()} type="button">{isStartingRealtime ? <LoaderCircle className="spin" size={15}/> : <Play size={15}/>} {isStartingRealtime ? text('正在连接', '接続中') : text('开始播放', '再生開始')}</button>}
              {file.realtime && realtimePlayback.current && playbackState !== 'ENDED' && ['REALTIME_TRANSCRIBING', 'DIARIZATION_FAILED'].includes(file.status) && <button className="primary-button" onClick={() => void endPlayback()} type="button"><Square size={15}/>{text('结束', '終了')}</button>}
              {file.status === 'DIARIZATION_FAILED' && <button className="secondary-button" onClick={() => void updateBatch(() => recordingApi.retryDiarization(file.id))} type="button"><RotateCcw size={15}/>{text('重试说话人分离', '話者分離を再試行')}</button>}
            </div>
          </div>)}</div>
        </section>

        <section className="recording-card transcript-area">
          <div className="section-title"><Mic2 size={19}/><div><h2>{text('确认对话与即时草稿', '確定会話とリアルタイム下書き')}</h2><p>{activeFile?.realtime ? text('即时文字先显示为草稿；分离后更新确认对话，全部收尾后识别业务角色。', 'リアルタイム表示は下書きです。話者分離後に確定会話を更新し、完了後に役割を判定します。') : text('点击时间可从对应位置播放。', '時間をクリックすると該当位置から再生します。')}</p></div></div>
          {activeFile && <>
            {activeFile.segments.length > 0 && <div className="speaker-controls">{Array.from(new Set(activeFile.segments.map((segment) => segment.speakerLabel))).filter((speaker) => !activeFile.realtime || ['A', 'B'].includes(speaker)).map((speaker) => {
              const segment = activeFile.segments.find((item) => item.speakerLabel === speaker)!
              return <label key={speaker}><span>{text('说话人', '話者')} {speaker}</span><select disabled={!canSummarize || batch.extractionRevision !== 0 || isSummarizing} value={segment.roleCode ?? 'UNKNOWN'} onChange={(event) => void updateBatch(() => recordingApi.setSpeakerRole(activeFile.id, speaker, event.target.value as SpeakerRole))}>{roleValues.map((role) => <option key={role} value={role}>{roleLabel(role, text)}</option>)}</select></label>
            })}</div>}
            <div className="transcript-segments">{displayedSegments.map((segment) => <article className={segment.id === activeSegmentId && !['NOT_READY', 'READY'].includes(playbackState) ? 'active' : currentTimeMs >= segment.endMs ? 'played' : 'upcoming'} key={segment.id} ref={(node) => { segment.segmentIds.forEach((id) => { transcriptSegmentRefs.current[id] = node }) }}>
              <button disabled={activeFile.realtime} onClick={() => { const audio = audioRefs.current[activeFile.id]; if (audio) { audio.currentTime = segment.startMs / 1000; void audio.play() } }} type="button"><Play size={12}/>{formatTime(segment.startMs)}–{formatTime(segment.endMs)}</button>
              <div className="recording-speaker-inline"><strong>{segment.roleCode && segment.roleCode !== 'UNKNOWN' ? `${roleLabel(segment.roleCode, text)}（${text('说话人', '話者')} ${segment.speakerLabel}）` : segment.speakerLabel === 'UNKNOWN' ? text('说话人未知', '話者未判定') : segment.speakerLabel === 'MIXED' ? text('A/B 混合，待确认', 'A/B混在・要確認') : `${text('说话人', '話者')} ${segment.speakerLabel}`}</strong>{activeFile.realtime && <label className="recording-segment-speaker" title={text('修正说话人', '話者を修正')}><span className="sr-only">{text('修正', '修正')}</span><select disabled={!canSummarize || batch.extractionRevision !== 0 || isSummarizing} value={segment.speakerLabel} onChange={(event) => void updateBatch(() => recordingApi.setSegmentSpeaker(activeFile.id, segment.id, event.target.value, segment.segmentIds))}><option value="A">A</option><option value="B">B</option><option value="UNKNOWN">{text('未知', '未判定')}</option><option value="MIXED">{text('A/B 混合', 'A/B混在')}</option></select></label>}</div><p>{segment.text}</p>
            </article>)}{activeDrafts.map((draft, index) => <article className="transcript-streaming" key={`stream-${index}`} aria-live="polite">
              <strong>{text('即时草稿 · 说话人待确认', 'リアルタイム下書き・話者確認待ち')}</strong><p>{draft}</p>
            </article>)}{isTranscribing && <div className="recording-transcript-pending">{displayedSegments.length ? text('正在识别后续内容……', '後続の内容を認識しています……') : text('正在生成转写文字，音频可继续播放。', '文字起こしを生成中です。音声はそのまま再生できます。')}</div>}{!isTranscribing && !activeFile.segments.length && !activeDrafts.length && <div className="recording-empty">{fileStatus(activeFile.status, text)}</div>}</div>
          </>}
        </section>

        <div className="recording-actions recording-summary-actions"><small>{batch.status === 'ROLE_INFERENCE' ? text('正在识别客服和客户角色。', '担当者と顧客の役割を判定中です。') : text('点击后提取设备与问题信息。', 'クリックすると機器・問題情報を抽出します。')}</small><button className="primary-button" disabled={!canSummarize || isSummarizing} onClick={() => void summarize()} type="button">{isSummarizing ? <LoaderCircle className="spin" size={16}/> : <Search size={16}/>} {text('对话总结', '会話の要約')}</button></div>

        {isExtracting && <div className="recording-extraction-wait" role="status" aria-live="polite">
          <span>{text('转写已完成，AI 正在提取设备问题信息，请稍候…', '文字起こしが完了しました。AIが機器の問題情報を抽出しています。しばらくお待ちください…')}</span>
        </div>}

        {showExtractedIssues && <section className="recording-card extracted-area" id="recording-issue-editor">
          <div className="section-title"><Search size={19}/><div><h2>{text('描述设备问题', '機器問題の抽出')}</h2><p>{text('确认、编辑或删除 AI 提取的信息。', 'AIが抽出した情報を確認、編集、削除できます。')}</p></div></div>
          {batch.status === 'EXTRACTION_FAILED' && <div className="recording-inline-error"><span>{batch.extractionError}</span><button className="secondary-button" onClick={() => void updateBatch(() => recordingApi.retryExtraction(batch.id, batch.conversationVersion))} type="button"><RotateCcw size={15}/>{text('重新提取', '再抽出')}</button></div>}
          <div className="extracted-list">{issueGroups.map(({ type, issues }) => issues.length ? issues.map((issue) => <article className={issue.deleted ? 'deleted' : ''} key={issue.id}>
              <span className="issue-type">{issueLabel(type, text)}</span>
              {editing?.id === issue.id ? <input autoFocus value={editing.value} onChange={(event) => setEditing({ id: issue.id, value: event.target.value })}/> : <div><p>{issue.correction?.status === 'LLM_PENDING_CONFIRMATION' && issue.correction.suggestedValue ? issue.correction.suggestedValue : issue.content}</p>{issue.type === 'ERROR_CODE' && ['UNRESOLVED', 'NO_DICTIONARY'].includes(issue.correction?.status ?? '') && <small className="identifier-unresolved">{text('未匹配到可确认的标准错误码，请核对原文或手动编辑。', '確認可能な標準エラーコードに一致しません。原文確認または手動編集を行ってください。')}</small>}</div>}
              <div className="issue-actions">
                {editing?.id === issue.id ? <><button onClick={() => void updateBatch(() => recordingApi.updateIssue(batch.id, issue.id, editing.value, issue.version)).then(() => setEditing(null))} type="button">{text('保存', '保存')}</button><button onClick={() => setEditing(null)} type="button">{text('取消', '取消')}</button></> : <>
                  {issue.correction?.status === 'LLM_PENDING_CONFIRMATION' && <span className="identifier-correction-tag">{text('AI 建议，需确认', 'AI提案・要確認')}</span>}
                  {issue.correction?.status === 'MANUAL_INPUT_REQUIRED' && <span className="identifier-manual-required-tag">{text('AI 无法确认标准值，请编辑此项', 'AIが標準値を特定できません。編集してください')}</span>}
                  <button disabled={!issue.evidence.length} onClick={() => setEvidenceIssue(issue)} type="button">{text('查看原文证据', '原文根拠')}</button>
                  {!issue.deleted && <button onClick={() => setEditing({ id: issue.id, value: issue.correction?.status === 'LLM_PENDING_CONFIRMATION' && issue.correction.suggestedValue ? issue.correction.suggestedValue : issue.content })} type="button"><Pencil size={14}/>{text('编辑', '編集')}</button>}
                  <button onClick={() => void updateBatch(() => issue.deleted ? recordingApi.restoreIssue(batch.id, issue.id) : recordingApi.deleteIssue(batch.id, issue.id))} type="button">{issue.deleted ? <RotateCcw size={14}/> : <Trash2 size={14}/>} {text(issue.deleted ? '恢复' : '删除', issue.deleted ? '復元' : '削除')}</button>
                </>}
              </div>
            </article>) : <article className="extracted-placeholder" key={`missing-${type}`}>
              <span className="issue-type">{issueLabel(type, text)}</span>
              {editing?.id === `missing-${type}` ? <input autoFocus value={editing.value} onChange={(event) => setEditing({ id: `missing-${type}`, value: event.target.value })}/> : <div><p>{text('尚未补充', '未入力')}</p></div>}
              <div className="issue-actions">{editing?.id === `missing-${type}` ? <><button disabled={!editing.value.trim()} onClick={() => void updateBatch(() => recordingApi.createIssue(batch.id, type, editing.value)).then(() => setEditing(null))} type="button">{text('保存', '保存')}</button><button onClick={() => setEditing(null)} type="button">{text('取消', '取消')}</button></> : <><button onClick={() => setEditing({ id: `missing-${type}`, value: '' })} type="button"><Pencil size={14}/>{text('编辑', '編集')}</button><button onClick={() => setDismissedIssueTypes((current) => [...current, type])} type="button"><Trash2 size={14}/>{text('删除', '削除')}</button></>}</div>
            </article>)}</div>
          {preview && <div className="composed-preview"><strong>{text('将填入出发前分析', '出発前分析へ入力する内容')}</strong><p>{preview}</p></div>}
          <div className="recording-actions">
            <div className="recording-transfer-notices" aria-live="polite">
              {!hasDeviceModel && <span className="identifier-manual-required-tag">{text('设备型号必填', '機器型式は必須です')}</span>}
              {batch.files.some((file) => file.status === 'FAILED') && <small>{text('失败文件未参与提取。', '失敗したファイルは抽出対象外です。')}</small>}
            </div>
            <button className="primary-button" disabled={(batch.status !== 'READY' && !(batch.status === 'REVIEW_REQUIRED' && !hasManualCorrections)) || !preview || !hasDeviceModel || isApplying} onClick={() => void apply()} type="button">{isApplying ? <LoaderCircle className="spin" size={17}/> : <Send size={17}/>} {text('转送到出发前分析', '出発前分析へ転送')}</button>
          </div>
        </section>}
      </>}

      {evidenceIssue && <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEvidenceIssue(null)}><section className="recording-evidence-dialog" role="dialog" aria-modal="true"><header><div><small>{issueLabel(evidenceIssue.type, text)}</small><h2>{text('原文证据', '原文根拠')}</h2></div><button aria-label={text('关闭', '閉じる')} onClick={() => setEvidenceIssue(null)} type="button"><X/></button></header><div className="recording-evidence-body">{evidenceIssue.evidence.map((evidence) => <article key={evidence.segmentId}><strong>{evidence.fileName}</strong><span>{roleLabel(evidence.roleCode ?? 'UNKNOWN', text)} · {text('说话人', '話者')} {evidence.speakerLabel}</span><button onClick={() => playEvidence(evidence)} type="button"><Play size={13}/>{formatTime(evidence.startMs)}–{formatTime(evidence.endMs)}</button><p>{evidence.text}</p></article>)}</div></section></div>}
    </main>
  )
}

function isTranscriptionStatus(status: RecordingBatch['status'] | undefined) {
  return status === 'UPLOADING' || status === 'TRANSCRIBING' || status === 'ROLE_INFERENCE' || status === 'DIARIZATION_FAILED'
}

function groupConsecutiveSpeakerSegments(segments: TranscriptSegment[]): Array<TranscriptSegment & { segmentIds: string[] }> {
  const grouped: Array<TranscriptSegment & { segmentIds: string[] }> = []
  for (const segment of segments) {
    const previous = grouped.at(-1)
    if (!previous || previous.speakerLabel !== segment.speakerLabel || ['UNKNOWN', 'MIXED'].includes(segment.speakerLabel)) {
      grouped.push({ ...segment, segmentIds: [segment.id] })
      continue
    }
    grouped[grouped.length - 1] = {
      ...previous,
      segmentIds: [...previous.segmentIds, segment.id],
      endMs: Math.max(previous.endMs, segment.endMs),
      text: `${previous.text.trimEnd()} ${segment.text.trimStart()}`,
      roleCode: segment.roleCode ?? previous.roleCode,
      roleConfidence: segment.roleConfidence ?? previous.roleConfidence,
      roleSource: segment.roleSource ?? previous.roleSource,
    }
  }
  return grouped
}

function PendingRecording({ file, onRemove, removeLabel }: { file: File; onRemove: () => void; removeLabel: string }) {
  return <div className="pending-recording">
    <div className="recording-file-meta"><strong><FileAudio size={14}/>{file.name}</strong><span>{formatBytes(file.size)}</span></div>
    <span className="recording-pending-state"><LoaderCircle className="spin" size={16}/></span>
    <button aria-label={removeLabel} onClick={onRemove} type="button"><X size={15}/></button>
  </div>
}

function message(value: unknown, text: (zh: string, ja: string) => string) {
  const detail = value instanceof Error ? value.message : ''
  const known: Record<string, string> = {
    REALTIME_AUDIO_LOAD_FAILED: text('无法读取录音文件，请检查网络连接及跨域配置。', '録音ファイルを読み込めません。ネットワーク接続とCORS設定を確認してください。'),
    REALTIME_AUDIO_DECODE_FAILED: text('浏览器无法解码该录音，请转换为 MP3 或 WAV 后重试。', 'この録音をブラウザーでデコードできません。MP3またはWAVに変換して再試行してください。'),
    REALTIME_DRAINING: text('音频仍在发送，请稍候再继续。', '音声を送信中です。しばらく待ってから再開してください。'),
    REALTIME_FRAME_ORDER: text('音频帧确认不一致，请重头演示。', '音声フレームの確認が一致しません。デモをやり直してください。'),
    REALTIME_INPUT_FAILED: text('实时音频输入失败，请重头演示。', 'リアルタイム音声入力に失敗しました。デモをやり直してください。'),
    REALTIME_FINISH_FAILED: text('实时转写收尾失败，请重头演示。', '文字起こしの終了処理に失敗しました。デモをやり直してください。'),
  }
  return known[detail] ?? (detail || text('操作失败，请稍后重试。', '操作に失敗しました。しばらくしてから再試行してください。'))
}
function formatBytes(value: number) { return value < 1024 * 1024 ? `${(value / 1024).toFixed(1)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB` }
function formatTime(ms: number) { const seconds = Math.floor(ms / 1000); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` }
function roleLabel(role: string, text: (zh: string, ja: string) => string) { return ({ CUSTOMER_SERVICE: text('客服', 'カスタマーサービス'), CUSTOMER: text('客户', '顧客'), FIELD_ENGINEER: text('维修工程师', '保守エンジニア'), OTHER: text('其他', 'その他'), UNKNOWN: text('未识别', '未判定') } as Record<string, string>)[role] ?? role }
function issueLabel(type: string, text: (zh: string, ja: string) => string) { return ({ MODEL: text('设备型号', '機器型式'), SYMPTOM: text('主要症状', '主な症状'), ERROR_CODE: text('错误码', 'エラーコード'), OPERATING_STATUS: text('当前运行状态', '現在の運転状態'), OCCURRENCE: text('发生时间 / 频率', '発生時期・頻度'), MEASUREMENT: text('现场测量值', '現場測定値'), ENVIRONMENT: text('安装环境', '設置環境'), RECENT_CHANGES: text('近期变化', '最近の変更'), PHOTO_EVIDENCE: text('现场照片', '現場写真'), OTHER: text('近期变化', '最近の変更') } as Record<string, string>)[type] ?? type }
function fileStatus(status: string, text: (zh: string, ja: string) => string) { return ({ DIARIZATION_FAILED: text('说话人分离失败，等待重试', '話者分離失敗・再試行待ち'), PREPARED: text('等待开始播放', '再生開始待ち'), ROLE_INFERENCE: text('正在识别角色', '役割判定中'), REALTIME_TRANSCRIBING: text('实时转写与说话人分离处理中', '文字起こし・話者分離処理中'), UPLOADED: text('等待转写', '文字起こし待ち'), TRANSCRIBING: text('正在转写', '文字起こし中'), COMPLETED: text('转写完成', '文字起こし完了'), FAILED: text('转写失败', '文字起こし失敗') } as Record<string, string>)[status] ?? status }
function statusText(status: string, text: (zh: string, ja: string) => string) { return ({ DIARIZATION_FAILED: text('说话人分离失败，等待重试', '話者分離失敗・再試行待ち'), PREPARED: text('等待开始播放', '再生開始待ち'), ROLE_INFERENCE: text('正在识别角色', '役割判定中'), UPLOADING: text('正在上传', 'アップロード中'), TRANSCRIBING: text('正在转写', '文字起こし中'), PARTIAL_SUCCESS: text('部分转写成功，等待对话总结', '一部文字起こし完了・要約待ち'), TRANSCRIBED: text('转写完成，等待对话总结', '文字起こし完了・要約待ち'), EXTRACTING: text('正在提取设备问题', '機器情報を抽出中'), REVIEW_REQUIRED: text('等待确认设备标识', '機器識別子の確認待ち'), READY: text('可以进入诊断', '診断を開始できます'), EXTRACTION_FAILED: text('问题提取失败', '抽出失敗'), FAILED: text('转写失败', '文字起こし失敗') } as Record<string, string>)[status] ?? status }
function canonicalIssueType(type: string) { return type === 'OTHER' ? 'RECENT_CHANGES' : type }
function compose(issues: ExtractedIssue[], language: string) { const labels: Record<string, string> = language === 'ja-JP' ? { MODEL:'機器型式',SYMPTOM:'主な症状',ERROR_CODE:'エラーコード',OPERATING_STATUS:'現在の運転状態',OCCURRENCE:'発生時期・頻度',MEASUREMENT:'現場測定値',ENVIRONMENT:'設置環境',RECENT_CHANGES:'最近の変更',PHOTO_EVIDENCE:'現場写真' } : { MODEL:'设备型号',SYMPTOM:'主要症状',ERROR_CODE:'错误码',OPERATING_STATUS:'当前运行状态',OCCURRENCE:'发生时间 / 频率',MEASUREMENT:'现场测量值',ENVIRONMENT:'安装环境',RECENT_CHANGES:'近期变化',PHOTO_EVIDENCE:'现场照片' }; const sections = issueOrder.map((type) => { const values = issues.filter((issue) => !issue.deleted && canonicalIssueType(issue.type) === type).map((issue) => trimTerminalPunctuation(issue.content)).filter(Boolean); return values.length ? `${labels[type]}：${[...new Set(values)].join('、')}` : '' }).filter(Boolean); return sections.length ? `${sections.join('。')}。` : '' }
function trimTerminalPunctuation(value: string) { return value.trim().replace(/[。．.!！?？]+$/u, '') }

function RecordingVolume({ getAudio, label }: { getAudio: () => HTMLAudioElement | null; label: string }) {
  const [open, setOpen] = useState(false)
  const [volume, setVolume] = useState(1)
  return <div className="recording-volume" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false) }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}>
    <button type="button" className="recording-volume-button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)}><Volume2 size={18}/></button>
    {open && <div className="recording-volume-popup"><input type="range" min="0" max="1" step="0.01" value={volume} aria-label={label} aria-orientation="vertical" onChange={(event) => { const value = Number(event.target.value); setVolume(value); const audio = getAudio(); if (audio) { audio.volume = value; audio.muted = value === 0 } }}/></div>}
  </div>
}
