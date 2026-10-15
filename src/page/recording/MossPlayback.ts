import { recordingApi } from '../../api'
import type { RecordingBatch } from '../../model'

/** The server transcribes the whole file; the media clock only advances the visible conversation. */
export class MossPlayback {
  private readonly audio: HTMLAudioElement
  private readonly fileId: string
  private readonly onBatch: (batch: RecordingBatch) => void
  private readonly onError: (message: string) => void
  private timer: number | undefined
  private disposed = false
  private ending = false
  private finished = false
  private sentPosition = -1
  private inFlight: Promise<void> | null = null
  constructor(audio: HTMLAudioElement, fileId: string, onBatch: (batch: RecordingBatch) => void, onError: (message: string) => void) {
    this.audio = audio; this.fileId = fileId; this.onBatch = onBatch; this.onError = onError
  }
  async start() {
    const batch = await recordingApi.startMoss(this.fileId)
    if (this.disposed) return
    this.onBatch(batch)
    const playback = batch.files.find((file) => file.id === this.fileId)?.mossPlayback
    this.audio.currentTime = (playback?.positionMs ?? 0) / 1000
    if (playback?.ended) { this.finished = true; return }
    await this.resume()
    this.timer = window.setInterval(() => {
      if (document.hidden) this.pause()
      this.sync()
    }, 250)
  }
  async resume() { if (!this.disposed && !this.ending && !this.finished) await this.audio.play() }
  pause() { this.audio.pause() }
  private sync() {
    if (this.disposed || this.ending || this.finished || this.inFlight) return
    const position = Math.floor(this.audio.currentTime * 1000)
    if (position <= this.sentPosition) return
    this.inFlight = recordingApi.progressMoss(this.fileId, position).then((batch) => {
      this.sentPosition = position
      if (!this.disposed && !this.ending) this.onBatch(batch)
    }).catch((error) => {
      if (!this.disposed && !this.ending) { this.pause(); this.onError(error instanceof Error ? error.message : 'MOSS_PLAYBACK_FAILED') }
    }).finally(() => { this.inFlight = null })
  }
  async finish() {
    if (this.disposed || this.ending || this.finished) return
    this.ending = true; this.pause()
    const cutoff = Math.floor(this.audio.currentTime * 1000)
    if (this.timer !== undefined) window.clearInterval(this.timer)
    await this.inFlight
    try {
      const batch = await recordingApi.finishMoss(this.fileId, cutoff)
      this.finished = true
      if (!this.disposed) this.onBatch(batch)
    } catch (error) {
      this.ending = false
      this.onError(error instanceof Error ? error.message : 'MOSS_FINISH_FAILED')
    }
  }
  async playEvidence(startMs: number) {
    if (!this.finished) return
    this.audio.currentTime = startMs / 1000
    await this.audio.play()
  }
  dispose(_release = false) {
    this.disposed = true; this.pause()
    if (this.timer !== undefined) window.clearInterval(this.timer)
    // No cancellation request: transcription and cache writes continue in the backend.
  }
}
