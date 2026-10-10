import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../src/page/recording/RealtimePlayback.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText.replace(/^import .*$/gm, '').replace('export class RealtimePlayback', 'class RealtimePlayback')
  .replace('import.meta.env.BASE_URL', "''") + '\nglobalThis.Playback = RealtimePlayback;'

function fixture(localFile) {
  let decodingError = null
  let playbackBlob
  let downloads = 0
  const calls = [], errors = [], revoked = []
  class Audio extends EventTarget {
    src = 'http://server/file.mp3'
    load() {}
    paused = true
    currentTime = 0
    play() { this.paused = false; this.dispatchEvent(new Event('playing')); return Promise.resolve() }
    pause() { this.paused = true }
  }
  class HttpRequestError extends Error { constructor(message, status) { super(message); this.status = status } }
  const api = {
    startRealtime: async () => ({sessionId:'session',batch:{id:'batch'}}),
    realtimeFrame: async (id,start,audio) => { calls.push({type:'frame',start,samples:Buffer.from(audio,'base64').length/2}); return {nextSample:start+Buffer.from(audio,'base64').length/2} },
    realtimeFrames: async (id,frames) => {
      let nextSample=frames[0].startSample
      for(const frame of frames) nextSample=(await api.realtimeFrame(id,frame.startSample,frame.audio)).nextSample
      return {nextSample,blocked:false}
    },
    finishRealtime: async () => { calls.push({type:'finish'});return {id:'batch'} },
    cancelRealtime: async () => { calls.push({type:'cancel'}) },
  }
  const channels = [new Float32Array(24000 * 4).fill(0.5), new Float32Array(24000 * 4).fill(-0.25)]
  class Context {
    async decodeAudioData(bytes) {
      // Real browsers detach the encoded ArrayBuffer during decodeAudioData.
      structuredClone(bytes,{transfer:[bytes]})
      if (decodingError) throw decodingError
      return { length: channels[0].length, sampleRate:24000, numberOfChannels:2, getChannelData:(i)=>channels[i] }
    }
    close() { return Promise.resolve() }
  }
  const context = vm.createContext({recordingApi:api,HttpRequestError,AudioContext:Context,
    Blob,URL:{createObjectURL:(blob)=>{playbackBlob=blob;return 'blob:local-recording'},revokeObjectURL:(url)=>revoked.push(url)},fetch:async()=>{downloads++;return{ok:true,headers:{get:()=> 'audio/mpeg'},arrayBuffer:async()=>new ArrayBuffer(8)}},AbortController,
    window:{setInterval,clearInterval,setTimeout},document:{hidden:false},setTimeout,console,
    btoa:(value)=>Buffer.from(value,'binary').toString('base64')})
  vm.runInContext(source,context)
  const audio = new Audio()
  let pressure = 0
  const playback = new context.Playback(audio,'file',()=>{},(error)=>errors.push(error),()=>{pressure++},localFile)
  return {playback,audio,calls,errors,api,HttpRequestError,channels,revoked,document:context.document,
    send:(samples)=>{audio.currentTime += samples/24000;audio.dispatchEvent(new Event('timeupdate'))},
    get downloads() {return downloads},get blob() {return playbackBlob},get pressure() {return pressure},failDecode:()=>{decodingError=new Error('decode failed')}}
}
const settle = () => new Promise((resolve)=>setImmediate(resolve))

test('HTTP file decoding sends no audio before playback advances and pause/resume preserves sample cursor',async()=>{
  const f=fixture()
  try {
    await f.playback.start(); assert.equal(f.calls.length,0)
    f.send(2400); await settle()
    f.playback.pause(); assert.equal(f.audio.paused,true)
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
    f.send(2400);await settle()
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
  f.api.realtimeFrames=()=>new Promise((done)=>{resolve=done})
  try {
    await f.playback.start();f.send(48000)
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
    await f.playback.start();f.send(48000)
    assert.equal(f.audio.paused,true)
    resolve();await settle();await settle()
    assert.equal(f.audio.paused,false)
    assert.equal(f.errors.length,0)
  } finally {f.playback.dispose(true)}
})

test('PCM is mono little endian and independent of player volume',async()=>{
  const f=fixture();let bytes
  f.api.realtimeFrame=async(id,start,audio)=>{bytes=Buffer.from(audio,'base64');return{nextSample:start+bytes.length/2}}
  try {
    await f.playback.start();f.audio.volume=0;f.send(2400);await settle()
    assert.equal(bytes.length,4800);assert.equal(bytes.readInt16LE(0),4096)
  } finally {f.playback.dispose(true)}
})

test('pause flushes a partial frame and finish preserves the final played tail',async()=>{
  const f=fixture()
  try {
    await f.playback.start();f.send(1200);await settle();assert.equal(f.calls.length,0)
    f.playback.pause();await settle();assert.equal(f.calls[0].samples,1200)
    await f.playback.resume();f.send(600);await f.playback.finish()
    assert.deepEqual(f.calls.map(x=>x.type),['frame','frame','finish'])
    assert.equal(f.calls[1].samples,600);assert.equal(f.calls[1].start,1200)
  } finally {f.playback.dispose(true)}
})

test('a stalled player does not send audio beyond its playback position',async()=>{
  const f=fixture()
  try {
    await f.playback.start();f.send(1200);f.audio.dispatchEvent(new Event('waiting'));await settle()
    assert.equal(f.calls[0].samples,1200)
    await new Promise(done=>setTimeout(done,70))
    assert.equal(f.calls.length,1)
    f.audio.dispatchEvent(new Event('playing'));f.send(2400);await settle()
    assert.equal(f.calls[1].start,1200)
  } finally {f.playback.dispose(true)}
})

test('finish drains a bounded backlog including samples not yet enqueued',async()=>{
  const f=fixture();let resolve;let first=true
  f.api.realtimeFrame=async(id,start,audio)=>{
    if(first){first=false;await new Promise(done=>{resolve=done})}
    f.calls.push({type:'frame',start,samples:Buffer.from(audio,'base64').length/2})
    return{nextSample:start+Buffer.from(audio,'base64').length/2}
  }
  try {
    await f.playback.start();f.send(72000)
    assert.equal(f.audio.paused,true)
    const finish=f.playback.finish();resolve();await finish
    assert.equal(f.calls.filter(x=>x.type==='frame').reduce((sum,x)=>sum+x.samples,0),72000)
    assert.equal(f.calls.at(-1).type,'finish')
  } finally {f.playback.dispose(true)}
})

test('decode failure never creates a realtime session',async()=>{
  const f=fixture();let opened=false
  f.api.startRealtime=async()=>{opened=true;return{sessionId:'session',batch:{}}}
  f.failDecode()
  try {await assert.rejects(()=>f.playback.start(),/REALTIME_AUDIO_DECODE_FAILED/);assert.equal(opened,false)}
  finally {f.playback.dispose(true)}
})
test('temporary network jitter batches the played backlog without pausing',async()=>{
  const f=fixture();let release;const requests=[]
  f.api.realtimeFrames=async(id,frames)=>{
    requests.push(Array.from(frames,frame=>frame.startSample))
    if(requests.length===1)await new Promise(done=>{release=done})
    const last=frames.at(-1)
    return{nextSample:last.startSample+Buffer.from(last.audio,'base64').length/2,blocked:false}
  }
  try {
    await f.playback.start();f.send(2400);f.send(12000)
    assert.equal(f.audio.paused,false);assert.equal(f.pressure,0)
    release();await settle()
    assert.deepEqual(requests,[[0],[2400,4800,7200,9600,12000]])
    assert.equal(f.audio.paused,false)
  } finally {f.playback.dispose(true)}
})

test('150ms HTTP latency sustains playback with 100ms input frames',async()=>{
  const f=fixture();let requests=0
  f.api.realtimeFrames=async(id,frames)=>{
    requests++;await new Promise(done=>setTimeout(done,150))
    const last=frames.at(-1)
    return{nextSample:last.startSample+Buffer.from(last.audio,'base64').length/2,blocked:false}
  }
  try {
    await f.playback.start()
    for(let i=0;i<12;i++){
      f.audio.currentTime=(i+1)/10;f.audio.dispatchEvent(new Event('timeupdate'))
      await new Promise(done=>setTimeout(done,100));assert.equal(f.audio.paused,false)
    }
    await f.playback.finish()
    assert.equal(f.pressure,0);assert.ok(requests<12)
  } finally {f.playback.dispose(true)}
})

test('partial batch pressure retries only unaccepted audio and resumes after recovery',async()=>{
  const f=fixture();const starts=[];let first=true
  f.api.realtimeFrames=async(id,frames)=>{
    starts.push(Array.from(frames,frame=>frame.startSample))
    if(first){first=false;return{nextSample:2400,blocked:true}}
    const last=frames.at(-1)
    return{nextSample:last.startSample+Buffer.from(last.audio,'base64').length/2,blocked:false}
  }
  try {
    await f.playback.start();f.send(7200);await settle()
    assert.equal(f.audio.paused,true)
    await new Promise(done=>setTimeout(done,550))
    assert.deepEqual(starts,[[0,2400,4800],[2400,4800]])
    assert.equal(f.audio.paused,false);assert.equal(f.errors.length,0)
  } finally {f.playback.dispose(true)}
})

test('lost batch response retries identical frames and validates acknowledgement boundaries',async()=>{
  const f=fixture();const requests=[]
  f.api.realtimeFrames=async(id,frames)=>{
    requests.push(frames)
    if(requests.length===1)throw new Error('network')
    return{nextSample:1,blocked:false}
  }
  try {
    await f.playback.start();f.send(7200);await settle()
    assert.deepEqual(requests[0],requests[1])
    assert.deepEqual(f.errors,['REALTIME_FRAME_ORDER'])
  } finally {f.playback.dispose(true)}
})
test('playback uses the downloaded local file and disposal restores the source',async()=>{
  const f=fixture()
  try {
    await f.playback.start();assert.equal(f.audio.src,'blob:local-recording')
    assert.equal(f.blob.size,8);assert.equal(f.blob.type,'audio/mpeg')
    assert.equal((await f.blob.arrayBuffer()).byteLength,8)
    f.playback.dispose(true)
    assert.equal(f.audio.src,'http://server/file.mp3');assert.deepEqual(f.revoked,['blob:local-recording'])
  } finally {f.playback.dispose(true)}
})
test('selected local recording never downloads content and preserves bytes through decoding',async()=>{
  const file=new Blob([new Uint8Array([1,2,3,4,5,6,7,8])],{type:'audio/mpeg'})
  const f=fixture(file)
  try {
    await f.playback.start()
    assert.equal(f.downloads,0);assert.equal(f.blob,file)
    assert.deepEqual(Array.from(new Uint8Array(await f.blob.arrayBuffer())),[1,2,3,4,5,6,7,8])
    f.send(2400);await settle();assert.equal(f.calls[0].samples,2400)
  } finally {f.playback.dispose(true)}
})

test('existing recording without a local file keeps the remote content fallback',async()=>{
  const f=fixture()
  try {await f.playback.start();assert.equal(f.downloads,1)}
  finally {f.playback.dispose(true)}
})