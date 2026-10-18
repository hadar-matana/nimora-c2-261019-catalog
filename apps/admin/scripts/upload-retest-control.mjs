// Bounded retest: GET-only content audit, no product/category mutation helpers.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {cf,query,identity,settings,docs,sanity} from './stage2-control.mjs';
const require=createRequire(import.meta.url),sharp=createRequire(require.resolve('next'))('sharp');
export const statePath='/private/tmp/atelier-upload-retest-state.json';
export const reportPath=new URL('../../../docs/admin-screenshots/upload-remote-retest.json',import.meta.url);
export const load=async()=>JSON.parse(await readFile(statePath,'utf8'));
export async function persist(s){await writeFile(statePath,JSON.stringify(s),{mode:0o600});await writeFile(reportPath,JSON.stringify(s,null,2)+'\n');}
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>createHash('sha256').update(JSON.stringify(canonical(x))).digest('hex');
const baseline=async()=>Object.fromEntries((await query('*[] | order(_id asc)')).map(d=>[d._id,hash(d)]));
const mode=process.argv[2];
if(import.meta.url===new URL('file://'+process.argv[1]).href){try{
 if(mode==='prepare'){
  await identity();const b=(await settings()).bindings;assert.equal(b.find(x=>x.name==='SANITY_ALLOW_PRODUCTION_WRITES').text,'disabled');
  for(const name of ['OWNER_USERNAME','OWNER_PASSWORD_HASH','CREDENTIAL_VERSION','SANITY_API_TOKEN'])assert.ok(b.some(x=>x.name===name&&x.type==='secret_text'));
  const qa=await docs();assert.equal(qa.length,1);assert.equal(qa[0]._id,'drafts.atelier-qa-20261015-0375d18c');
  const original=await readFile(new URL('../public/demo/dress.png',import.meta.url));const folder='/private/tmp/atelier-upload-retest-20261016';await mkdir(folder,{recursive:true});
  const files=[];for(const format of ['png','webp']){
   const image=sharp(original).withMetadata({exif:{IFD0:{ImageDescription:'ATELIER bounded upload retest 2026-10-16 '+format}}});
   const bytes=await(format==='png'?image.png({compressionLevel:7,adaptiveFiltering:true}):image.webp({lossless:true})).toBuffer();
   const sha1=createHash('sha1').update(bytes).digest('hex');assert.equal((await query('*[_type=="sanity.imageAsset" && sha1hash==$sha1]',{sha1})).length,0,'Do not reupload an existing asset');
   const path=folder+'/atelier-qa-retest.'+format;await writeFile(path,bytes,{mode:0o600});files.push({path,format,bytes:bytes.length,sha1});
  }
  const s={startedAt:new Date().toISOString(),personalAccountsVerified:true,freePlanDashboardVerified:true,baseline:await baseline(),qaBaselineHash:hash(qa[0]),hookBaselineHash:hash(await sanity('/hooks/projects/3ahm0828')),files,attempts:[],checks:[],uploads:[]};
  await writeFile(statePath,JSON.stringify(s),{flag:'wx',mode:0o600});await persist(s);console.log(JSON.stringify({prepared:true,files},null,2));
 }else if(mode==='attempt'){
  const s=await load();assert.ok(s.attempts.length<2,'Two-attempt bound reached');assert.ok(!s.stopReason,'Retest already stopped');const file=s.files[s.attempts.length];s.attempts.push({at:new Date().toISOString(),...file});await persist(s);console.log(JSON.stringify({attempt:s.attempts.length,file}));
 }else if(mode==='audit'){
  const s=await load(),now=await baseline();const changed=Object.keys(s.baseline).filter(id=>now[id]!==s.baseline[id]);
  const added=Object.keys(now).filter(id=>!(id in s.baseline));const qa=await docs();
  s.audit={at:new Date().toISOString(),preexistingCount:Object.keys(s.baseline).length,changedPreexistingIds:changed,newIds:added,qaUnpublishedAndUnchanged:qa.length===1&&hash(qa[0])===s.qaBaselineHash,webhookUnchanged:hash(await sanity('/hooks/projects/3ahm0828'))===s.hookBaselineHash};
  s.uploads=[];
  for(const assetId of added){const [a]=await query('*[_id==$id]',{id:assetId});s.uploads.push({assetId,size:a.size,mimeType:a.mimeType,sha1:a.sha1hash,width:a.metadata?.dimensions?.width,height:a.metadata?.dimensions?.height});}
  await persist(s);assert.equal(changed.length,0);assert.ok(s.audit.qaUnpublishedAndUnchanged&&s.audit.webhookUnchanged);assert.ok(added.length<=2&&added.every(id=>id.startsWith('image-')));console.log(JSON.stringify({audit:s.audit,uploads:s.uploads},null,2));
 }else if(mode==='verify-gates'||mode==='verify-disabled'){
  const s=await load(),session=JSON.parse(await readFile('/private/tmp/atelier-stage2-session.json','utf8'));
  const b=(await settings()).bindings;assert.equal(b.find(x=>x.name==='SANITY_ALLOW_PRODUCTION_WRITES').text,'disabled');
  if(mode==='verify-disabled')assert.ok(!b.some(x=>x.name==='SANITY_UPLOAD_RETEST_UNTIL'&&Number(x.text)>Date.now()));
  const urls=['/api/products/atelier-qa-20261015-0375d18c','/api/categories',...(mode==='verify-disabled'?['/api/uploads']:[])];
  for(const path of urls){for(const action of path.includes('/products/')?['draft','publish','unpublish']:['probe']){
   const r=await fetch('https://atelier-admin.hadarmat.workers.dev'+path,{method:'POST',headers:{Cookie:session.cookie,Origin:'https://atelier-admin.hadarmat.workers.dev','X-CSRF-Token':session.csrf,'Content-Type':'application/json'},body:JSON.stringify({action,product:{}}),signal:AbortSignal.timeout(30000)});assert.equal(r.status,403);await r.text();
  }}
  s.checks.push({at:new Date().toISOString(),mode,passed:true});s.finalBindings=b.filter(x=>x.type==='plain_text'&&['SANITY_ALLOW_PRODUCTION_WRITES','SANITY_UPLOAD_RETEST_UNTIL'].includes(x.name)).map(x=>({name:x.name,text:x.text}));await persist(s);console.log('PASS '+mode+': authenticated mutation endpoints return 403');
 }else throw Error('Unknown mode');
}catch(e){console.error('Retest control stopped: '+(e.code??e.name)+'. No credentials displayed.');process.exitCode=1;}}
