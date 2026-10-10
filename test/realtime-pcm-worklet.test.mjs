import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function fixture() {
  let Processor
  const messages = []
  const context = vm.createContext({
    sampleRate: 48000,
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: (data) => messages.push(data), onmessage: null } } },
    registerProcessor: (_, implementation) => { Processor = implementation },
  })
  vm.runInContext(readFileSync(new URL('../public/realtime-pcm-worklet.js', import.meta.url), 'utf8'), context)
  return { capture: new Processor(), messages }
}

test('paused playback sends no audio and flush acknowledgment is explicit', () => {
  const { capture, messages } = fixture()
  capture.process([[new Float32Array(4800).fill(0.2)]], [[new Float32Array(4800)]])
  assert.equal(messages.length, 0)
  capture.port.onmessage({ data: { enabled: false, flushAck: true } })
  assert.equal(messages.length, 1)
  assert.equal(messages[0].byteLength, 0)
})

test('48k audio is downmixed once and emitted as 100ms 24k PCM frames', () => {
  const { capture, messages } = fixture()
  capture.port.onmessage({ data: { enabled: true } })
  const output = new Float32Array(4800)
  capture.process([[new Float32Array(4800).fill(0.2), new Float32Array(4800).fill(0.6)]], [[output]])
  assert.equal(messages.length, 1)
  assert.equal(messages[0].byteLength, 4800)
  assert.ok(Math.abs(output[100] - 0.4) < 1e-6)
  assert.equal(new Int16Array(messages[0])[100], Math.round(0.4 * 32767))
})

test('pause flushes a short tail and resume has no duplicate or lost samples', () => {
  const { capture, messages } = fixture()
  capture.port.onmessage({ data: { enabled: true } })
  capture.process([[new Float32Array(1000).fill(0.2)]], [[new Float32Array(1000)]])
  capture.port.onmessage({ data: { enabled: false, flushAck: true } })
  assert.equal(messages[0].byteLength, 1000)
  capture.process([[new Float32Array(1000).fill(0.2)]], [[new Float32Array(1000)]])
  capture.port.onmessage({ data: { enabled: true } })
  capture.process([[new Float32Array(4800).fill(0.2)]], [[new Float32Array(4800)]])
  assert.equal(messages[2].byteLength, 4800)
  assert.equal(messages.reduce((sum, data) => sum + data.byteLength / 2, 0), 2900)
})
