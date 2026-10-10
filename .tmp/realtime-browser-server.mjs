import http from 'node:http'
import { readFileSync } from 'node:fs'
import path from 'node:path'
const root = path.resolve('.tmp/realtime-browser-build')
const clients = new Set()
const file = { id:'rf_browser',name:'DEMO.wav',contentType:'audio/wav',sizeBytes:1440044,status:'PREPARED',errorCode:null,errorMessage:null,segments:[],realtime:true }
const batch = {id:'rb_browser',language:'ja-JP',status:'PREPARED',extractionRevision:0,extractionError:null,files:[file],issues:[],createdAt:'2026-10-10T12:00:00'}
const stats = { frames:0,samples:0,started:0,finished:0,extractions:0 }
const wav = Buffer.alloc(44 + 24000*30*2)
wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(24000,24);wav.writeUInt32LE(48000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40)
for(let i=0;i<24000*30;i++) wav.writeInt16LE(Math.round(1000*Math.sin(2*Math.PI*120*i/24000)),44+i*2)
function emit(type,payload) { for(const response of clients)response.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`) }
function publish() { emit('batch',batch) }
function reply(response,value,status=200) { response.writeHead(status,{'Content-Type':'application/json'});response.end(JSON.stringify(value)) }
http.createServer(async(request,response)=>{
const pathname = new URL(request.url,'http://localhost').pathname
if(pathname==='/__test/state') return reply(response,{...stats,status:batch.status,fileStatus:file.status})
if(pathname.endsWith('/transcription-stream')) {response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache'});clients.add(response);response.write(`event: batch\ndata: ${JSON.stringify(batch)}\n\n`);request.on('close',()=>clients.delete(response));return}
if(pathname.endsWith('/content')) {response.writeHead(200,{'Content-Type':'audio/wav','Content-Length':wav.length});response.end(wav);return}
if(pathname==='/api/v1/recording-batches/rb_browser') return reply(response,batch)
if(pathname.endsWith('/realtime-sessions')) {stats.started++;batch.status='TRANSCRIBING';file.status='REALTIME_TRANSCRIBING';return reply(response,{sessionId:'rt_browser',batch})}
if(pathname.endsWith('/frames')) {let body='';for await(const part of request)body+=part;const frame=JSON.parse(body);if(frame.startSample!==stats.samples)return reply(response,{detail:'frame order'},409);stats.frames++;stats.samples+=Buffer.from(frame.audio,'base64').length/2;
if(stats.frames%20===0){const sequence=file.segments.length;file.segments.push({id:'seg_'+sequence,sequenceNo:sequence,speakerLabel:sequence%2?'B':'A',roleCode:null,roleConfidence:null,roleSource:'NONE',startMs:Math.max(0,stats.samples/24-2000),endMs:stats.samples/24,text:sequence%2?'冷却できず、警報が続いています。':'機器の型式を教えてください。'});publish();emit('transcript-final',{fileId:file.id,segmentId:'draft'})}else if(stats.frames%5===0)emit('delta',{fileId:file.id,segmentId:'draft',delta:'認識中…'});return reply(response,{nextSample:stats.samples})}
if(pathname.endsWith('/finish')) {stats.finished++;batch.status='ROLE_INFERENCE';file.status='ROLE_INFERENCE';reply(response,batch);setTimeout(()=>{batch.status='TRANSCRIBED';file.status='COMPLETED';for(const segment of file.segments)segment.roleCode=segment.speakerLabel==='A'?'CUSTOMER_SERVICE':'CUSTOMER';publish()},500);return}
if(pathname.endsWith('/issue-extractions')) {stats.extractions++;batch.status='EXTRACTING';reply(response,batch);setTimeout(()=>{batch.status='READY';batch.extractionRevision=1;batch.issues=[{id:'issue',type:'SYMPTOM',content:'冷却できず、警報が続いています。',originalContent:'冷却できず、警報が続いています。',editedByUser:false,deleted:false,version:0,evidence:[],correction:null}];publish()},500);return}
if(pathname==='/api/v1/recording-realtime-sessions/rt_browser' &&request.method==='DELETE') {batch.status='FAILED';file.status='FAILED';publish();response.writeHead(204);response.end();return}
if(pathname.startsWith('/api'))return reply(response,{detail:'Unsupported test endpoint'},404)
try {const relative=pathname==='/'||pathname==='/recordings'?'index.html':pathname.slice(1);const full=path.resolve(root,relative);if(!full.startsWith(root+path.sep))throw new Error();let body=readFileSync(full);if(relative==='index.html')body=Buffer.from(body.toString().replace('<head>','<head><script>history.replaceState({recordingBatchId:"rb_browser"},"","/recordings")</script>'));response.writeHead(200,{'Content-Type':relative.endsWith('.js')?'application/javascript':relative.endsWith('.css')?'text/css':relative.endsWith('.html')?'text/html':'application/octet-stream'});response.end(body)}catch{response.writeHead(404);response.end()}
}).listen(4199,'127.0.0.1',()=>process.stdout.write('Mock browser server listening on 127.0.0.1:4199\n'))
