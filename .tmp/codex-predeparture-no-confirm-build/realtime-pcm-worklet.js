// Capture the media element's decoded audio, not a microphone or speaker loopback.
class RealtimePcm extends AudioWorkletProcessor {
  constructor() {
    super()
    this.enabled = false
    this.samples = []
    this.phase = 0
    this.port.onmessage = ({ data }) => {
      this.enabled = data.enabled
      if (!this.enabled) this.flush()
      if (data.flushAck) this.port.postMessage(new ArrayBuffer(0))
    }
  }
  flush() {
    if (!this.samples.length) return
    const frame = new Int16Array(this.samples)
    this.port.postMessage(frame.buffer, [frame.buffer])
    this.samples = []
  }
  process(inputs, outputs) {
    const input = inputs[0]
    const output = outputs[0]
    if (!input?.length) return true
    // Downmix once: the same mono signal is heard and sent for transcription.
    for (let i = 0; i < input[0].length; i++) {
      let value = 0
      for (const channel of input) value += channel[i] / input.length
      for (const channel of output) channel[i] = value
      if (!this.enabled) continue
      this.phase += 24000
      while (this.phase >= sampleRate) {
        this.phase -= sampleRate
        this.samples.push(Math.round(Math.max(-1, Math.min(1, value)) * (value < 0 ? 32768 : 32767)))
        if (this.samples.length >= 2400) this.flush()
      }
    }
    return true
  }
}
registerProcessor('realtime-pcm', RealtimePcm)
