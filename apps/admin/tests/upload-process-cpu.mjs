// Host OS CPU is measured for the entire local workerd process (including auth),
// not the fixture Node process, and is not Cloudflare billable per-request CPU.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),sharp=createRequire(require.resolve('next'))('sharp');
const base='http://127.0.0.1:3002';
const a=JSON.parse(await readFile('/private/tmp/atelier-integration-account.json','utf8'));
const r=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json','CF-Connecting-IP':'cpu-batch-'+Date.now()},body:JSON.stringify(a)});assert.equal(r.status,200);
const headers={Cookie:r.headers.get('set-cookie').split(';')[0],Origin:base,'X-CSRF-Token':(await r.json()).csrf};
assert.equal((await(await fetch(base+'/api/catalog',{headers})).json()).environment,'fixture');
const log=await readFile('/private/tmp/atelier-upload-profile.log','utf8');const line=log.split('\n').findLast(l=>l.includes('handleProxyControllerIncomingMessage')&&l.includes('"reloadComplete"')&&l.includes('"userWorkerUrl"'));const c=JSON.parse(line.slice(line.indexOf('{'))).proxyData;
const target=c.userWorkerUrl.protocol+'//'+c.userWorkerUrl.hostname+':'+c.userWorkerUrl.port;
const pid=execFileSync('/usr/sbin/lsof',['-nP','-iTCP:'+c.userWorkerUrl.port,'-sTCP:LISTEN','-Fp'],{encoding:'utf8'}).match(/^p(\d+)/m)?.[1];assert.ok(pid);
const cpu=()=>{const t=execFileSync('/bin/ps',['-p',pid,'-o','time='],{encoding:'utf8'}).trim().split(':').map(Number);return t.reduce((n,x)=>n*60+x,0)*1000;};
const png=await readFile(new URL('../public/demo/dress.png',import.meta.url)),jpeg=await sharp(png).jpeg({quality:95}).toBuffer(),webp=await sharp(png).webp({lossless:true}).toBuffer(),max=Buffer.alloc(10*1024*1024);png.copy(max);
const rows=[];
for(const [name,bytes,type,chunked] of [['session',null],['PNG',png,'image/png'],['JPEG',jpeg,'image/jpeg'],['WebP',webp,'image/webp'],['10MiB-padded-PNG',max,'image/png'],['PNG-chunked',png,'image/png',true]]){
 const send=async()=>{let body=bytes;if(chunked){let offset=0;body=new ReadableStream({pull(ctrl){if(offset===bytes.length){ctrl.close();return;}const end=Math.min(offset+16384,bytes.length);ctrl.enqueue(bytes.subarray(offset,end));offset=end;}});}const response=await fetch(target+(bytes?'/api/uploads':'/api/session'),{method:bytes?'POST':'GET',headers:{...c.headers,...headers,...(bytes?{'Content-Type':type}:{}),Connection:'close'},...(bytes?{body,...(chunked?{duplex:'half'}:{})}:{})});assert.equal(response.status,200);await response.json();};
 await send();const batches=[];
 for(let batch=0;batch<3;batch++){const start=cpu(),wall=performance.now();for(let n=0;n<40;n++)await send();batches.push({requests:40,processCpuMs:cpu()-start,wallMs:performance.now()-wall});}
 const result={name,bytes:bytes?.length??0,requests:120,batches,meanProcessCpuMsPerRequest:batches.reduce((n,b)=>n+b.processCpuMs,0)/120};rows.push(result);console.log(JSON.stringify({name,meanProcessCpuMsPerRequest:result.meanProcessCpuMsPerRequest}));
}
const source=await readFile(new URL('../worker/uploads.ts',import.meta.url));
const result={at:new Date().toISOString(),label:process.argv[2],sourceSha256:createHash('sha256').update(source).digest('hex'),runtime:'Host OS CPU for one local workerd process, direct Worker requests, three 40-request warm batches per scenario',qualification:'Includes native runtime, auth DO and internal services sharing the process; excludes Node fixture CPU and network waiting. Host ps has 10 ms aggregate resolution. No inspector attached during CPU batches. Batch means do not characterize individual tails or remote billed CPU.',rows};
await writeFile(new URL('../../../docs/admin-screenshots/upload-process-cpu-'+result.label+'.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
