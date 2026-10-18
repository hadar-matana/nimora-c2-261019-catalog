import "./legacy-demo-only.mjs";
// Every mutation is bounded to the retained QA identity; no automatic retries.
import assert from 'node:assert/strict';
import {readFile,unlink} from 'node:fs/promises';
import {id,origin,sessionPath,load,persist,request,docs,settings} from './stage2-control.mjs';
const s=await load(),mode=process.argv[2];let step=mode;
const pass=(label,detail={})=>{s.checks.push({label,at:new Date().toISOString(),...detail});console.log('PASS '+label);};
async function current(){const r=await request('/api/catalog');assert.equal(r.status,200);return r.data.products.find(p=>p.id===id);}
async function save(action,p){assert.equal(p.id,id);s.attempts.push({mode,action,at:new Date().toISOString()});await persist(s);const r=await request('/api/products/'+id,{method:'POST',body:{action,product:p}});assert.equal(r.status,200,'QA action HTTP '+r.status);return r.data;}
try{
 if(mode==='guards'){
  const b=(await settings()).bindings;assert.equal(b.find(x=>x.name==='ADMIN_QA_PRODUCT_ID').text,id);assert.equal(b.find(x=>x.name==='SANITY_ALLOW_PRODUCTION_WRITES').text,'approved');
  for(const path of ['/api/products/'+id,'/api/uploads','/api/categories','/api/site-settings'])assert.equal((await request(path,{method:'POST',body:{},anonymous:true})).status,401);
  pass('Unauthenticated mutation/upload/settings routes rejected');
  for(const headers of [{'X-CSRF-Token':'wrong'},{'X-CSRF-Token':''},{Origin:'https://untrusted.invalid'}])assert.equal((await request('/api/products/'+id,{method:'POST',body:{},headers})).status,403);
  pass('Missing/invalid CSRF and foreign origin rejected');
  assert.equal((await request('/api/products/not-authorized',{method:'POST',body:{}})).status,403);assert.equal((await request('/api/categories',{method:'POST',body:{categories:[]}})).status,403);
  assert.equal((await request('/api/site-settings',{method:'POST',body:{}})).status,405);pass('Non-QA products, category writes and site settings rejected');
  for(let n=0;n<3;n++)assert.equal((await request('/api/session')).status,200);pass('Existing owner session persists across authenticated requests');
  const p=await current();assert.ok(p?.status==='draft');
  for(const product of [{...p,name:''},{...p,priceAgorot:-1},{...p,categoryId:'nonexistent'}])assert.equal((await request('/api/products/'+id,{method:'POST',body:{action:'draft',product}})).status,400);
  pass('Invalid product fields rejected');
 }else if(mode==='upload'){
  assert.ok(!s.attempts.some(a=>a.mode==='upload'),'Upload already attempted; do not retry');
  s.attempts.push({mode,at:new Date().toISOString(),file:'dress.png'});await persist(s);
  const bytes=await readFile(new URL('../public/demo/dress.png',import.meta.url));const start=Date.now();
  const r=await request('/api/uploads',{method:'POST',raw:true,body:bytes,headers:{'Content-Type':'image/png'}});
  s.uploadResponse={at:new Date().toISOString(),status:r.status,bytes:bytes.length,wallMs:Date.now()-start};await persist(s);
  assert.equal(r.status,200,'Remote upload failed; STOP');assert.ok(r.data.assetId&&r.data.bytes===bytes.length);
  s.uploads.push(r.data);pass('Real remote streaming PNG upload accepted',{bytes:bytes.length,assetId:r.data.assetId,deduplicated:s.originalImages.includes(r.data.assetId)});
 }else if(mode==='draft'){
  assert.ok(!s.attempts.some(a=>a.mode===mode),'No repeat draft writes');assert.equal(s.uploads.length,1);
  const p=await current();p.description+=' בדיקת Stage 2 מבוקרת.';await save('draft',p);
  const d=await docs();assert.equal(d.length,1);assert.equal(d[0]._id,'drafts.'+id);assert.equal(d[0].slug.current,s.slug);assert.deepEqual(d[0].images.map(i=>i.asset._ref),s.originalImages);
  const preview=await request('/api/products/'+id+'/preview');assert.equal(preview.status,200);assert.equal(preview.data.description,p.description);assert.equal((await request('/api/products/'+id+'/preview',{anonymous:true})).status,401);
  pass('Native draft saved with stable slug and original images; authenticated preview succeeds; anonymous preview rejected');
 }else if(mode==='publish'||mode==='edit'){
  assert.ok(!s.attempts.some(a=>a.mode===mode),'No repeat publication');
  const p=await current();assert.equal(p.status,mode==='publish'?'draft':'published');
  if(mode==='edit'){assert.ok(s.observations?.some(o=>o.containsQa&&o.deployments.some(d=>d.status==='success')),'Wait for initial publication');p.name=s.name+' — Stage 2';p.priceAgorot+=100;s.editedName=p.name;}
  await save('publish',p);const d=await docs();assert.equal(d.length,1);assert.equal(d[0]._id,id);assert.equal(d[0].slug.current,s.slug);assert.equal(d[0].name,p.name);pass(mode==='edit'?'One published QA edit saved':'Retained QA product published');
 }else if(mode==='unpublish'){
  assert.ok(!s.attempts.some(a=>a.mode===mode),'No repeat unpublish');await save('unpublish',await current());
  const d=await docs();assert.equal(d.length,1);assert.equal(d[0]._id,'drafts.'+id);assert.equal(d[0].name,s.editedName??s.name);assert.deepEqual(d[0].images.map(i=>i.asset._ref),s.originalImages);assert.equal(d[0].slug.current,s.slug);
  pass('QA unpublished; recoverable native draft, images and slug intact');
 }else if(mode==='logout'){
  assert.equal((await request('/api/logout',{method:'POST'})).status,200);assert.equal((await request('/api/session')).status,401);await unlink(sessionPath);pass('Test session revoked; replay rejected; private session file removed');
 }else throw new Error('Unknown lifecycle mode');
 await persist(s);
}catch(e){s.failure={step,at:new Date().toISOString(),kind:e.code??e.name};await persist(s);console.error('STOP: '+step+' failed. No credentials displayed. Inspect sanitized state and HTTP status; do not retry mutations.');process.exitCode=1;}
