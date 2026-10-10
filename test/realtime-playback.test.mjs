import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/page/recording/RealtimePlayback.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import .*$/gm, '').replace('export class RealtimePlayback', 'class RealtimePlayback')
  .replace('import.meta.env.BASE_URL', "''") + '\nglobalThis.Playback = RealtimePlayback;'

function fixture() {
  let capture
  const calls = [], commands = [], errors = []
  class Audio extends EventTarget {
    paused = true
    currentTime = 0
    play() { this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve() }
    pause() { this.paused = true }
  }
  class HttpRequestError extends Error { constructor(message, status) { super(message); this.status = status } }
  const api = {
    startRealtime: async () => ({sessionId:'session',batch:{id:'batch'}}),
    realtimeFrame: async (id,start,audio) => { calls.push({type:'frame',start,samples:Buffer.from(audio,'base64').length/2}); return {nextSample:start+Buffer.from(audio,'base64').length/2} },
    finishRealtime: async () => { calls.push({type:'finish'});return {id:'batch'} },
    cancelRealtime: async () => { calls.push({type:'cancel'}) },
  }
  class Context {
    audioWorklet = { addModule: async () => {} }
    createMediaElementSource() { return {connect:()=>{}} }
    resume() { return Promise.resolve() }
    suspend() { return Promise.resolve() }
    close() { return Promise.resolve() }
  }
  class Capture {
    constructor() {
      capture = this
      this.port = { onmessage:null, postMessage: (command) => {
        commands.push(command)
        if(command.flushAck)queueMicrotask(()=>this.port.onmessage?.({data:new ArrayBuffer(0)}))
      } }
    }
    connect() {}
  }
  const context = vm.createContext({recordingApi:api,HttpRequestError,AudioContext:Context,AudioWorkletNode:Capture,
    window:{setInterval,clearInterval,setTimeout},document:{hidden:false},setTimeout,console,
    btoa:(value)=>Buffer.from(value,'binary').toString('base64')})
  vm.runInContext(source,context)
  const audio = new Audio()
  let pressure = 0
  const playback = new context.Playback(audio,'file',()=>{},(error)=>errors.push(error),()=>{pressure++})
  return {playback,audio,calls,commands,errors,api,HttpRequestError,
    send:(samples)=>capture.port.onmessage?.({data:new Int16Array(samples).buffer}),
    get pressure() {return pressure},get capture() {return capture}}
}
const settle = () => new Promise((resolve)=>setImmediate(resolve))

test('start sends no audio before worklet frames and pause/resume preserves sample cursor',async()=>{
  const f=fixture()
  try {
    await f.playback.start(); assert.equal(f.calls.length,0)
    f.send(2400); await settle()
    f.playback.pause(); assert.equal(f.audio.paused,true);assert.equal(f.commands.at(-1).enabled,false)
    await f.playback.resume(); f.send(2400);await settle()
    assert.deepEqual(f.calls.filter(x=>x.type==='frame').map(x=>x.start),[0,2400])
  } finally {f.playback.dispose(true)}
})

test('finish drains pending audio before ending and evidence replay does not send new input',async()=>{
  const f=fixture()
  try {
    await f.playback.start();f.send(2400);await f.playback.finish()
    assert.equal(f.audio.paused,true)
    assert.deepEqual(f.calls.map(x=>x.type),['frame','finish'])
    await f.playback.playEvidence(1000)
    assert.equal(f.audio.currentTime,1)
    assert.equal(f.capture.port.onmessage,null)
    assert.equal(f.calls.filter(x=>x.type==='frame').length,1)
  } finally {f.playback.dispose(true)}
})

test('lost response retries exactly the same frame',async()=>{
  const f=fixture();let attempts=0;const starts=[]
  f.api.realtimeFrame=async(id,start,audio)=>{starts.push(start);if(attempts++===0)throw new Error('network');return{nextSample:start+Buffer.from(audio,'base64').length/2}}
  try {await f.playback.start();f.send(2400);await settle();assert.deepEqual(starts,[0,0]);assert.equal(f.errors.length,0)}
  finally {f.playback.dispose(true)}
})

test('bounded queue pauses playback and blocks resume while an upload is pending',async()=>{
  const f=fixture();let resolve
  f.api.realtimeFrame=()=>new Promise((done)=>{resolve=done})
  try {
    await f.playback.start();for(let i=0;i<5;i++)f.send(2400)
    assert.equal(f.audio.paused,true);assert.ok(f.pressure>0)
    await assert.rejects(()=>f.playback.resume(),/REALTIME_DRAINING/)
    f.playback.dispose(true);resolve({nextSample:2400});await settle()
  } finally {f.playback.dispose(true)}
})

test('disposing during connection setup cancels the newly opened session without playback',async()=>{
  const f=fixture();let resolve
  f.api.startRealtime=()=>new Promise((done)=>{resolve=done})
  const start=f.playback.start();await settle()
  f.playback.dispose(true);resolve({sessionId:'late',batch:{id:'batch'}});await start;await settle()
  assert.equal(f.audio.paused,true);assert.equal(f.calls.filter(x=>x.type==='cancel').length,1)
})

test('backpressure resumes playback automatically after the queued frames drain',async()=>{
  const f=fixture();let resolve;let first=true
  f.api.realtimeFrame=async(id,start,audio)=>{
    if(first){first=false;await new Promise(done=>{resolve=done})}
    return {nextSample:start+Buffer.from(audio,'base64').length/2}
  }
  try {
    await f.playback.start();for(let i=0;i<5;i++)f.send(2400)
    assert.equal(f.audio.paused,true)
    resolve();await settle();await settle()
    assert.equal(f.audio.paused,false)
    assert.equal(f.errors.length,0)
  } finally {f.playback.dispose(true)}
})
