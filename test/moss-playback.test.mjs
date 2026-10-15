import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/page/recording/MossPlayback.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import .*$/gm, '').replace('export class MossPlayback', 'class MossPlayback') + '\nglobalThis.Playback = MossPlayback;'

function fixture() {
  const calls = [], batches = [], errors = []
  let tick
  const audio = { currentTime: 0, paused: true, async play() { this.paused = false }, pause() { this.paused = true } }
  const batch = (positionMs = 0, ended = false) => ({ id: 'batch', files: [{ id: 'file', mossPlayback: { positionMs, ended } }] })
  const api = {
    startMoss: async () => { calls.push(['start']); return batch() },
    progressMoss: async (_, position) => { calls.push(['progress', position]); return batch(position) },
    finishMoss: async (_, position) => { calls.push(['finish', position]); return batch(position, true) },
  }
  const context = vm.createContext({ recordingApi: api, document: { hidden: false }, window: { setInterval: (fn) => { tick = fn; return 1 }, clearInterval: () => { tick = undefined } } })
  vm.runInContext(source, context)
  return { audio, api, calls, batches, errors, tick: () => tick?.(), batch,
    playback: new context.Playback(audio, 'file', (next) => batches.push(next), (error) => errors.push(error)) }
}
const settle = () => new Promise((resolve) => setImmediate(resolve))

test('MOSS sends playback positions only and finish freezes the exact media clock', async () => {
  const f = fixture()
  await f.playback.start()
  f.audio.currentTime = 1.25; f.tick(); await settle()
  f.audio.currentTime = 1.5; await f.playback.finish()
  f.audio.currentTime = 30; f.tick(); await settle()
  assert.deepEqual(f.calls, [['start'], ['progress', 1250], ['finish', 1500]])
  assert.equal(f.audio.paused, true)
  assert.equal(f.batches.at(-1).files[0].mossPlayback.ended, true)
  f.playback.dispose()
})

test('finishing waits for pending progress and never publishes its stale response', async () => {
  const f = fixture(); let resolve
  f.api.progressMoss = () => new Promise((done) => { resolve = done })
  await f.playback.start(); f.audio.currentTime = 1; f.tick()
  f.audio.currentTime = 1.5; const finish = f.playback.finish()
  resolve(f.batch(1000)); await finish
  assert.equal(f.batches.length, 2)
  assert.equal(f.batches.at(-1).files[0].mossPlayback.positionMs, 1500)
  f.playback.dispose()
})

test('disposing or closing playback does not issue a transcription cancellation', async () => {
  const f = fixture(); await f.playback.start(); f.playback.dispose(true)
  await settle(); assert.deepEqual(f.calls, [['start']]); assert.equal(f.audio.paused, true)
})

test('reopening ended playback restores its cutoff without restarting audio', async () => {
  const f = fixture(); f.api.startMoss = async () => f.batch(1500, true)
  await f.playback.start(); await f.playback.resume(); f.tick()
  assert.equal(f.audio.currentTime, 1.5); assert.equal(f.audio.paused, true)
  assert.deepEqual(f.calls, []); f.playback.dispose()
})
