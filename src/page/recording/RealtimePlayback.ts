import { recordingApi } from '../../api'
import { HttpRequestError } from '../../api/client'
import type { RecordingBatch } from '../../model'

/** A persistent graph per media element. Browsers cannot attach a second source to an element. */
const graphs = new WeakMap<HTMLAudioElement, { context: AudioContext; capture: AudioWorkletNode }>()

export class RealtimePlayback {
  private sessionId = ''
  private graph: { context: AudioContext; capture: AudioWorkletNode } | null = null
  private queue: ArrayBuffer[] = []
  private sending = false
  private sample = 0
  private stopped = false
  private ending = false
  private finishSent = false
  private flushWaiter: (() => void) | null = null
  private timer: number | undefined
  private autoResume = false
  private throttle() { this.pause(); this.autoResume = true; this.onBackpressure() }
  private continueAfterPressure() {
    if (!this.autoResume || document.hidden || this.queue.length || this.sending || this.stopped || this.ending) return
    this.autoResume = false
    void this.resume().catch((error) => this.onError(error instanceof Error ? error.message : 'REALTIME_INPUT_FAILED'))
  }
  private readonly playing = () => this.graph?.capture.port.postMessage({ enabled: true })
  private readonly waiting = () => this.graph?.capture.port.postMessage({ enabled: false })
  private audio: HTMLAudioElement
  private fileId: string
  private onBatch: (batch: RecordingBatch) => void
  private onError: (message: string) => void
  private onBackpressure: () => void
  constructor(audio: HTMLAudioElement, fileId: string,
    onBatch: (batch: RecordingBatch) => void, onError: (message: string) => void,
    onBackpressure: () => void) {
    this.audio = audio; this.fileId = fileId; this.onBatch = onBatch
    this.onError = onError; this.onBackpressure = onBackpressure
    audio.addEventListener('playing', this.playing)
    audio.addEventListener('waiting', this.waiting)
  }

  async start() {
    // Called from the user's button event, before awaiting any network request.
    let graph = graphs.get(this.audio)
    if (!graph) {
      const context = new AudioContext({ sampleRate: 24000 })
      try {
        if (!context.audioWorklet) throw new Error('AUDIO_WORKLET_UNAVAILABLE')
        await context.audioWorklet.addModule(`${import.meta.env.BASE_URL}realtime-pcm-worklet.js`)
        if (this.stopped) { await context.close(); return }
        const source = context.createMediaElementSource(this.audio)
        const capture = new AudioWorkletNode(context, 'realtime-pcm', { outputChannelCount: [1] })
        source.connect(capture); capture.connect(context.destination)
        graph = { context, capture }; graphs.set(this.audio, graph)
      } catch (error) { await context.close(); throw error }
    }
    this.graph = graph
    await graph.context.resume()
    if (this.stopped) return
    graph.capture.port.onmessage = ({ data }: MessageEvent<ArrayBuffer>) => {
      if (this.stopped) return
      if (!data.byteLength) { this.flushWaiter?.(); this.flushWaiter = null; return }
      this.queue.push(data)
      if (this.queue.length >= 5) this.throttle()
      void this.drain()
    }
    const started = await recordingApi.startRealtime(this.fileId)
    if (this.stopped) { void recordingApi.cancelRealtime(started.sessionId); return }
    this.sessionId = started.sessionId
    this.onBatch(started.batch)
    this.audio.currentTime = 0
    await this.resume()
    this.timer = window.setInterval(() => {
      if (!this.audio.paused && document.hidden) this.throttle()
      this.continueAfterPressure()
    }, 500)
  }

  async resume() {
    if (this.stopped || this.ending) return
    if (this.queue.length || this.sending) throw new Error('REALTIME_DRAINING')
    await this.graph?.context.resume()
    try { await this.audio.play() }
    catch (error) { this.pause(); throw error }
  }
  pause() { this.autoResume = false; this.audio.pause(); this.graph?.capture.port.postMessage({ enabled: false }) }

  async finish() {
    if (this.stopped || this.ending) return
    this.ending = true
    this.pause()
    // Acknowledge the worklet flush before finishing; no tail frame may be lost.
    await new Promise<void>((resolve) => {
      this.flushWaiter = resolve
      this.graph?.capture.port.postMessage({ enabled: false, flushAck: true })
    })
    this.audio.removeEventListener('playing', this.playing)
    this.audio.removeEventListener('waiting', this.waiting)
    if (this.graph) this.graph.capture.port.onmessage = null
    while (!this.stopped && (this.sending || this.queue.length)) await new Promise<void>((resolve) => window.setTimeout(resolve, 25))
    if (!this.stopped && this.sessionId) {
      try { this.finishSent = true; this.onBatch(await recordingApi.finishRealtime(this.sessionId)) }
      catch (error) {
        this.finishSent = false
        this.onError(error instanceof Error ? error.message : 'REALTIME_FINISH_FAILED')
        this.dispose()
      }
    }
    if (this.timer !== undefined) window.clearInterval(this.timer)
  }

  async playEvidence(startMs: number) {
    if (!this.finishSent) return
    await this.graph?.context.resume()
    this.audio.currentTime = startMs / 1000
    await this.audio.play()
  }

  dispose(release = false) {
    if (release && this.graph) {
      graphs.delete(this.audio)
      void this.graph.context.close()
    }
    if (this.stopped) return
    this.stopped = true
    this.pause(); this.queue = []
    this.audio.removeEventListener('playing', this.playing)
    this.audio.removeEventListener('waiting', this.waiting)
    this.flushWaiter?.(); this.flushWaiter = null
    if (this.timer !== undefined) window.clearInterval(this.timer)
    if (this.sessionId && !this.finishSent) void recordingApi.cancelRealtime(this.sessionId).catch(() => {})
    if (this.graph) {
      this.graph.capture.port.onmessage = null
      if (!release) void this.graph.context.suspend()
    }
  }

  private async drain() {
    if (this.sending || !this.sessionId || this.stopped) return
    this.sending = true
    try {
      while (this.queue.length && !this.stopped) {
        const frame = this.queue[0]
        const bytes = new Uint8Array(frame)
        const audio = btoa(String.fromCharCode(...bytes))
        let next: { nextSample: number } | undefined
        let networkRetry = false
        while (!this.stopped && !next) {
          try { next = await recordingApi.realtimeFrame(this.sessionId, this.sample, audio) }
          catch (error) {
            if (error instanceof HttpRequestError && error.status === 429) {
              this.throttle()
              await new Promise<void>((resolve) => window.setTimeout(resolve, 500))
            } else if (!(error instanceof HttpRequestError) && !networkRetry) {
              networkRetry = true // Same frame is idempotent even if its first response was lost.
            } else throw error
          }
        }
        if (!next || this.stopped) return
        if (next.nextSample !== this.sample + bytes.length / 2) throw new Error('REALTIME_FRAME_ORDER')
        this.sample = next.nextSample; this.queue.shift()
      }
    } catch (error) {
      this.onError(error instanceof Error ? error.message : 'REALTIME_INPUT_FAILED')
      this.dispose()
    } finally { this.sending = false; this.continueAfterPressure() }
  }
}
