// Local-only V8 samples; never a remote billed CPU certificate.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=createRequire(require.resolve('next'))('sharp'),WS=createRequire(require.resolve('wrangler'))('ws');
const base='http://127.0.0.1:3002';
const account=JSON.parse(await readFile('/private/tmp/atelier-integration-account.json','utf8'));
const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','CF-Connecting-IP':'profile-'+Date.now()},body:JSON.stringify(account)});assert.equal(login.status,200);
const session={cookie:login.headers.get('set-cookie').split(';')[0],csrf:(await login.json()).csrf};
await writeFile('/private/tmp/atelier-integration-session.json',JSON.stringify(session),{mode:0o600});
const headers={Cookie:session.cookie,Origin:base,'X-CSRF-Token':session.csrf};
assert.equal((await(await fetch(base+'/api/catalog',{headers})).json()).environment,'fixture');
const log=await readFile('/private/tmp/atelier-upload-profile.log','utf8');
const line=log.split('\n').findLast(l=>l.includes('handleProxyControllerIncomingMessage')&&l.includes('"reloadComplete"')&&l.includes('"userWorkerUrl"'));
const config=JSON.parse(line.slice(line.indexOf('{'))).proxyData;
const target=config.userWorkerUrl.protocol+'//'+config.userWorkerUrl.hostname+':'+config.userWorkerUrl.port;
const inspector=config.userWorkerInspectorUrl;
const targets=await(await fetch('http://'+inspector.hostname+':'+inspector.port+'/json/list')).json();
const outer=targets.find(t=>t.id==='core:user:atelier-outer-verification');assert.ok(outer,'Exact outer Worker inspector target required');
const ws=new WS(outer.webSocketDebuggerUrl,{headers:{Origin:'http://localhost'}});await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
let serial=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data),p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error('Inspector command failed')):p.resolve(m.result);}};
const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
await cmd('Profiler.enable');await cmd('Profiler.setSamplingInterval',{interval:100});
const png=await readFile(new URL('../public/demo/dress.png',import.meta.url));
const jpeg=await sharp(png).jpeg({quality:95}).toBuffer(),webp=await sharp(png).webp({lossless:true}).toBuffer();
const max=Buffer.alloc(10*1024*1024);png.copy(max);
const rows=[];
try{
 for(const [name,data,type,chunked] of [['session',null],['PNG',png,'image/png'],['JPEG',jpeg,'image/jpeg'],['WebP',webp,'image/webp'],['10MiB-padded-PNG',max,'image/png'],['PNG-chunked',png,'image/png',true]]){
  const upload=async()=>{
   let body=data;
   if(chunked){let offset=0;body=new ReadableStream({pull(c){if(offset===data.length){c.close();return;}const end=Math.min(offset+16384,data.length);c.enqueue(data.subarray(offset,end));offset=end;}});}
   const r=await fetch(target+(data?'/api/uploads':'/api/session'),{method:data?'POST':'GET',headers:{...config.headers,...headers,...(data?{'Content-Type':type}:{}),Connection:'close'},...(data?{body,...(chunked?{duplex:'half'}:{})}:{})});assert.equal(r.status,200,name);await r.json();
  };
  await upload(); // warm application/fixture; cold remote starts remain unverified
  const samples=[];const stacks={};
  for(let n=0;n<15;n++){
   await cmd('Profiler.start');const t=performance.now();await upload();const wallMs=performance.now()-t;const {profile}=await cmd('Profiler.stop');
   const nodes=new Map(profile.nodes.map(n=>[n.id,n]));let nonIdle=0,js=0,gc=0,bcrypt=0;
   for(let i=0;i<(profile.samples??[]).length;i++){
    const f=nodes.get(profile.samples[i])?.callFrame,us=profile.timeDeltas[i];
    if(f?.functionName!=='(idle)')nonIdle+=us;if(f?.url)js+=us;if(f?.functionName==='(garbage collector)')gc+=us;
    if(/bcrypt|_crypt|_encipher/.test((f?.url??'')+' '+f?.functionName))bcrypt+=us;
    if(f?.url){const key=f.functionName||'(anonymous)';stacks[key]=(stacks[key]??0)+us;}
   }
   assert.equal(bcrypt,0,'Outer Worker profile must exclude password verification');
   samples.push({wallMs,sampledNonIdleMs:nonIdle/1000,sampledJavascriptMs:js/1000,sampledGcMs:gc/1000});
  }
  const summary={};for(const key of Object.keys(samples[0])){const sorted=samples.map(s=>s[key]).sort((a,b)=>a-b);summary[key]={median:sorted[7],p95:sorted[14],mean:sorted.reduce((a,b)=>a+b,0)/15};}
  rows.push({name,bytes:data?.length??0,repeats:15,summary,topJavascriptStacks:Object.entries(stacks).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([functionName,us])=>({functionName,totalSampledMs:us/1000})),samples});
  console.log(JSON.stringify({name,bytes:data?.length??0,...summary}));
 }
 const result={at:new Date().toISOString(),label:process.argv[2]??'sample',inspectorTarget:outer.id,runtime:'Local workerd, isolated auth DO, direct outer Worker port, real isolated decoding/hash fixture',qualification:'Inspector sample time deltas include scheduling gaps and runtime frames; neither sampled non-idle time nor wall time equals billed CPU. Native C++ may be underrepresented. Warm 15-request samples do not certify cold starts, tails or remote Free compliance.',rows};
 await writeFile(new URL('../../../docs/admin-screenshots/upload-profile-'+result.label+'.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
}finally{ws.terminate();}
