import "./legacy-demo-only.mjs";
// Temporary real-time debugger connection, not a deployed Tail Worker.
// Raw events may contain cookies: process in memory and persist ONLY this whitelist.
import {readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),WS=createRequire(require.resolve('wrangler'))('ws');
const cfg=await readFile(homedir()+'/Library/Preferences/.wrangler/config/default.toml','utf8');const token=cfg.match(/^oauth_token\s*=\s*"([^"\n]+)"/m)?.[1];
const path='/accounts/07eb45a2b5a037d1138beea811cf549b/workers/scripts/atelier-admin/tails';
const reportPath=new URL('../../../docs/admin-screenshots/stage2-activation-tail.json',import.meta.url);
const report={startedAt:new Date().toISOString(),source:'Temporary trace-v1 WebSocket, in-memory redaction before any output/persistence',records:[]};
async function cf(route,method){const r=await fetch('https://api.cloudflare.com/client/v4'+route,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(method==='POST'?{body:'{}'}:{}),signal:AbortSignal.timeout(30000)});assert.ok(r.ok,'Cloudflare debugger request failed: '+r.status);return r.json();}
assert.equal((await(await fetch('https://api.cloudflare.com/client/v4/user',{headers:{Authorization:'Bearer '+token}})).json()).result.email,'hadarmat@gmail.com');
const tail=(await cf(path,'POST')).result;assert.ok(tail.url&&tail.id);
const ws=new WS(tail.url,'trace-v1',{headers:{'User-Agent':'atelier-private-retest'}});
let queue=Promise.resolve(),closing=false;
const persist=()=>writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
ws.on('open',()=>{ws.send(JSON.stringify({debug:false}));console.log('Private sanitized activation trace collector connected. No headers or raw events will be saved.');});
ws.on('message',raw=>{
 try{
  const t=JSON.parse(raw.toString());const request=t.event?.request;
  if(!request||!new URL(request.url).pathname.startsWith('/api/'))return;
  const markers=[];
  for(const log of t.logs??[])for(const entry of log.message??[]){
   let x;try{x=typeof entry==='string'?JSON.parse(entry):entry;}catch{continue;}
   if(x?.event!=='atelier-upload-retest')continue;
   const item={phase:x.phase==='accepted'?'accepted':'transport'};
   if(['fixed-length','counted'].includes(x.transport))item.transport=x.transport;
   if(Number.isSafeInteger(x.declaredBytes))item.declaredBytes=x.declaredBytes;
   if(Number.isSafeInteger(x.bytes))item.bytes=x.bytes;
   if(typeof x.assetId==='string'&&/^image-[a-f0-9]{40}-\d+x\d+-(png|jpg|webp)$/.test(x.assetId))item.assetId=x.assetId;
   markers.push(item);
  }
  const finite=(...x)=>x.find(v=>typeof v==='number'&&Number.isFinite(v))??null;
  const record={receivedAt:new Date().toISOString(),eventTimestamp:t.eventTimestamp??null,path:new URL(request.url).pathname,method:request.method,status:t.event?.response?.status??null,outcome:typeof t.outcome==='string'?t.outcome:null,cpuTimeMs:finite(t.cpuTime,t.cpuTimeMs),wallTimeMs:finite(t.wallTime,t.wallTimeMs),memoryUsageBytes:finite(t.memoryUsageBytes),exceptionCount:Array.isArray(t.exceptions)?t.exceptions.length:0,availableTopLevelFields:Object.keys(t).sort(),markers};
  report.records.push(record);
  if(markers.length&&record.cpuTimeMs>10)report.stopReason='Observed upload CPU exceeds 10 ms';
  queue=queue.then(persist).then(()=>console.log(JSON.stringify(record))).catch(()=>console.error('Sanitized trace persistence failed; stop testing.'));
 }catch{console.error('Trace format could not be parsed; raw event suppressed.');}
});
async function close(){if(closing)return;closing=true;clearInterval(heartbeat);clearTimeout(deadline);ws.close();await queue;try{await cf(path+'/'+tail.id,'DELETE');report.debuggerConnectionRemoved=true;}catch{report.debuggerConnectionRemoved=false;}report.finishedAt=new Date().toISOString();await persist();process.exit(0);}
ws.on('error',()=>console.error('Private trace connection error; no raw details displayed.'));
const heartbeat=setInterval(()=>{if(ws.readyState===WS.OPEN)ws.ping();},10000);
const deadline=setTimeout(close,45*60000);process.on('SIGINT',close);process.on('SIGTERM',close);
await persist();
