import { recordingApi } from '../../api'
import { HttpRequestError } from '../../api/client'
import type { RecordingBatch } from '../../model'

const SAMPLE_RATE = 24000
const FRAME_SAMPLES = 2400
// Absorb up to two seconds of network jitter; upstream model pressure still pauses immediately.
const MAX_QUEUED_FRAMES = 20
const MAX_BATCH_FRAMES = 5

export class RealtimePlayback {
  private sessionId = ''
  private decoded: AudioBuffer | null = null
  private context: AudioContext | null = null
  private channels: Float32Array[] = []
  private playbackUrl = ''
  private originalSrc = ''
  private readonly download = new AbortController()
  private cursor = 0
  private capturing = false
  private pumping = false
  private queue: ArrayBuffer[] = []
  private sending = false
  private sample = 0
  private stopped = false
  private ending = false
  private finishSent = false
  private timer: number | undefined
  private autoResume = false
  private throttle() { this.pause(); this.autoResume = true; this.onBackpressure() }
  private continueAfterPressure() {
    if (!this.autoResume || document.hidden || this.queue.length || this.sending || this.stopped || this.ending) return
    this.autoResume = false
    void this.resume().catch((error) => this.onError(error instanceof Error ? error.message : 'REALTIME_INPUT_FAILED'))
  }
  private readonly playing = () => { if (!this.stopped && !this.ending) this.capturing = true }
  private readonly waiting = () => { this.capturePlayed(true); this.capturing = false }
  private readonly timeupdate = () => { if (this.capturing) this.capturePlayed() }
  private audio: HTMLAudioElement
  private fileId: string
  private localFile?: Blob
  private onBatch: (batch: RecordingBatch) => void
  private onError: (message: string) => void
  private onBackpressure: () => void
  constructor(audio: HTMLAudioElement, fileId: string,
    onBatch: (batch: RecordingBatch) => void, onError: (message: string) => void,
    onBackpressure: () => void, localFile?: Blob) {
    this.audio = audio; this.fileId = fileId; this.onBatch = onBatch; this.localFile = localFile
    this.onError = onError; this.onBackpressure = onBackpressure
    audio.addEventListener('playing', this.playing)
    audio.addEventListener('waiting', this.waiting)
    audio.addEventListener('pause', this.waiting)
    audio.addEventListener('timeupdate', this.timeupdate)
  }

  async start() {
    // Decode the same file the player uses. AudioWorklet and microphone permissions are unnecessary.
    const context = new AudioContext({ sampleRate: SAMPLE_RATE })
    this.context = context
    try {
      let source: Blob
      let bytes: ArrayBuffer
      if (this.localFile) {
        source = this.localFile
        bytes = await source.arrayBuffer()
      } else {
        // Existing recordings without a browser-local file retain the server fallback.
        const response = await fetch(this.audio.currentSrc || this.audio.src, { signal: this.download.signal })
        if (!response.ok) throw new Error('REALTIME_AUDIO_LOAD_FAILED')
        bytes = await response.arrayBuffer()
        source = new Blob([bytes], { type: response.headers.get('Content-Type') || 'application/octet-stream' })
      }
      if (this.stopped) return
      let decoded: AudioBuffer
      try { decoded = await context.decodeAudioData(bytes.slice(0)) }
      catch { throw new Error('REALTIME_AUDIO_DECODE_FAILED') }
      if (this.stopped) return
      this.decoded = decoded
      this.channels = Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i))
      // Reuse the downloaded file for playback instead of issuing a second streaming HTTP request.
      this.originalSrc = this.audio.src
      this.playbackUrl = URL.createObjectURL(source)
      this.audio.src = this.playbackUrl
      this.audio.load()
    } finally {
      if (this.context === context) { this.context = null; await context.close() }
    }
    if (this.stopped) return
    const started = await recordingApi.startRealtime(this.fileId)
    if (this.stopped) { void recordingApi.cancelRealtime(started.sessionId).catch(() => {}); return }
    this.sessionId = started.sessionId
    this.onBatch(started.batch)
    this.audio.currentTime = 0
    await this.resume()
    this.timer = window.setInterval(() => {
      if (!this.audio.paused && document.hidden) this.throttle()
      if (this.capturing) this.capturePlayed()
      this.continueAfterPressure()
    }, 25)
  }

  // Only enqueue samples already reached by the media clock, never future audio.
  private capturePlayed(flush = false) {
    const decoded = this.decoded
    if (!decoded || this.stopped || this.finishSent || this.pumping || !this.sessionId) return
    this.pumping = true
    try {
      const total = Math.floor(decoded.length * SAMPLE_RATE / decoded.sampleRate)
      const played = Math.min(total, Math.floor(this.audio.currentTime * SAMPLE_RATE))
      const channels = this.channels
      while (this.cursor < played && this.queue.length < MAX_QUEUED_FRAMES) {
        const count = Math.min(FRAME_SAMPLES, played - this.cursor)
        if (count < FRAME_SAMPLES && !flush) break
        const frame = new ArrayBuffer(count * 2)
        const pcm = new DataView(frame)
        for (let i = 0; i < count; i++) {
          const index = Math.min(decoded.length - 1, Math.floor((this.cursor + i) * decoded.sampleRate / SAMPLE_RATE))
          let value = 0
          for (const channel of channels) value += channel[index] / channels.length
          value = Math.max(-1, Math.min(1, value))
          pcm.setInt16(i * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true)
        }
        this.cursor += count
        this.queue.push(frame)

      }
      if (this.queue.length >= MAX_QUEUED_FRAMES && !this.ending && !this.audio.paused) this.throttle()
    } finally { this.pumping = false }
    // Collect the full played range first, so delayed ticks can share one HTTP request.
    void this.drain()
  }

  async resume() {
    if (this.stopped || this.ending) return
    if (this.queue.length || this.sending) throw new Error('REALTIME_DRAINING')
    // Catch up any played samples held back by the bounded queue before advancing playback.
    this.capturePlayed(true)
    if (this.queue.length || this.sending) { this.autoResume = true; return }
    try { await this.audio.play() }
    catch (error) { this.pause(); throw error }
  }
  pause() {
    this.autoResume = false
    this.audio.pause()
    this.capturePlayed(true)
    this.capturing = false
  }

  private removeListeners() {
    this.audio.removeEventListener('playing', this.playing)
    this.audio.removeEventListener('waiting', this.waiting)
    this.audio.removeEventListener('pause', this.waiting)
    this.audio.removeEventListener('timeupdate', this.timeupdate)
  }

  async finish() {
    if (this.stopped || this.ending) return
    this.ending = true
    this.pause()
    this.removeListeners()
    if (this.timer !== undefined) window.clearInterval(this.timer)
    // Flush the played tail even if a slow request temporarily filled the queue.
    while (!this.stopped) {
      this.capturePlayed(true)
      if (!this.sending && !this.queue.length) break
      await new Promise<void>((resolve) => window.setTimeout(resolve, 25))
    }
    if (!this.stopped && this.sessionId) {
      try { this.finishSent = true; this.onBatch(await recordingApi.finishRealtime(this.sessionId)) }
      catch (error) {
        this.finishSent = false
        this.onError(error instanceof Error ? error.message : 'REALTIME_FINISH_FAILED')
        this.dispose()
      }
    }
    this.decoded = null; this.channels = []
  }

  async playEvidence(startMs: number) {
    if (!this.finishSent) return
    this.audio.currentTime = startMs / 1000
    await this.audio.play()
  }

  dispose(_release = false) {
    if (this.stopped) return
    this.stopped = true
    this.download.abort()
    if (this.context) { void this.context.close().catch(() => {}); this.context = null }
    this.pause(); this.queue = []; this.decoded = null; this.channels = []
    if (this.playbackUrl) {
      if (this.audio.src === this.playbackUrl) { this.audio.src = this.originalSrc; this.audio.load() }
      URL.revokeObjectURL(this.playbackUrl); this.playbackUrl = ''
    }
    this.removeListeners()
    if (this.timer !== undefined) window.clearInterval(this.timer)
    if (this.sessionId && !this.finishSent) void recordingApi.cancelRealtime(this.sessionId).catch(() => {})
  }

  private async drain() {
    if (this.sending || !this.sessionId || this.stopped) return
    this.sending = true
    try {
      while (this.queue.length && !this.stopped) {
        const batch = this.queue.slice(0, MAX_BATCH_FRAMES)
        let endSample = this.sample
        const frames = batch.map((frame) => {
          const startSample = endSample
          const bytes = new Uint8Array(frame)
          endSample += bytes.length / 2
          return { startSample, audio: btoa(String.fromCharCode(...bytes)) }
        })
        let next: { nextSample: number; blocked: boolean } | undefined
        let networkRetry = false
        while (!this.stopped && !next) {
          try { next = await recordingApi.realtimeFrames(this.sessionId, frames) }
          catch (error) {
            if (error instanceof HttpRequestError && error.status === 429) {
              this.throttle()
              await new Promise<void>((resolve) => window.setTimeout(resolve, 500))
            } else if (!(error instanceof HttpRequestError) && !networkRetry) {
              networkRetry = true // Same batch is idempotent even if its first response was lost.
            } else throw error
          }
        }
        if (!next || this.stopped) return
        let acknowledged = 0
        let boundary = this.sample
        while (acknowledged < batch.length && boundary < next.nextSample) {
          boundary += batch[acknowledged].byteLength / 2
          acknowledged++
        }
        if (boundary !== next.nextSample || (!acknowledged && !next.blocked)) throw new Error('REALTIME_FRAME_ORDER')
        this.sample = next.nextSample
        this.queue.splice(0, acknowledged)
        if (next.blocked) {
          this.throttle()
          await new Promise<void>((resolve) => window.setTimeout(resolve, 500))
        }
      }
    } catch (error) {
      this.onError(error instanceof Error ? error.message : 'REALTIME_INPUT_FAILED')
      this.dispose()
    } finally { this.sending = false; this.continueAfterPressure() }
  }
}
