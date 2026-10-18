import "./legacy-demo-only.mjs";
// Controlled QA only. Never prints credentials or raw service error bodies.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
export const id='atelier-qa-20261015-0375d18c';
export const origin='https://atelier-admin.hadarmat.workers.dev';
export const statePath='/private/tmp/atelier-stage2-state.json';
export const reportPath=new URL('../../../docs/admin-screenshots/stage2-live-tests.json',import.meta.url);
export const sessionPath='/private/tmp/atelier-stage2-session.json';
const account='07eb45a2b5a037d1138beea811cf549b';
const cfConfig=await readFile(homedir()+'/Library/Preferences/.wrangler/config/default.toml','utf8');
const cfToken=cfConfig.match(/^oauth_token\s*=\s*"([^"\n]+)"/m)?.[1];
const personal=JSON.parse(await readFile(homedir()+'/.config/sanity/config.json','utf8')).authToken;
async function service(url,token,options={}){
 const r=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:AbortSignal.timeout(60000)});
 assert.ok(r.ok,'Service request rejected: HTTP '+r.status);return r.json();
}
export const cf=(path,options)=>service('https://api.cloudflare.com/client/v4'+path,cfToken,options);
export const sanity=(path,options)=>service('https://3ahm0828.api.sanity.io/v2025-02-19'+path,personal,options);
export async function query(groq,params={}){
 const u=new URL('https://3ahm0828.api.sanity.io/v2025-02-19/data/query/production');u.searchParams.set('query',groq);u.searchParams.set('perspective','raw');for(const[k,v]of Object.entries(params))u.searchParams.set('$'+k,JSON.stringify(v));
 return (await service(u,personal)).result;
}
export const docs=()=>query('*[_id in $ids]',{ids:[id,'drafts.'+id]});
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export async function baseline(){
 const all=await query('*[!(_id in $ids)] | order(_id asc)',{ids:[id,'drafts.'+id]});
 return Object.fromEntries(all.map(d=>[d._id,hash(d)]));
}
export const load=async()=>JSON.parse(await readFile(statePath,'utf8'));
export async function persist(s){await writeFile(statePath,JSON.stringify(s),{mode:0o600});await writeFile(reportPath,JSON.stringify(s,null,2)+'\n');}
export async function identity(){assert.equal((await cf('/user')).result.email,'hadarmat@gmail.com');assert.equal((await sanity('/users/me')).email,'hadarmat@gmail.com');}
export const settings=async()=>(await cf('/accounts/'+account+'/workers/scripts/atelier-admin/settings')).result;
export async function request(path,{method='GET',body,headers={},anonymous=false,raw=false}={}){
 const s=anonymous?{}:JSON.parse(await readFile(sessionPath,'utf8'));
 const r=await fetch(origin+path,{method,redirect:'manual',headers:{Origin:origin,...(!anonymous?{Cookie:s.cookie,'X-CSRF-Token':s.csrf}:{}),...(body&&!raw?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:raw?body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(65000)});
 const data=r.headers.get('Content-Type')?.includes('application/json')?await r.json():null;return {status:r.status,data,headers:r.headers};
}
const mode=process.argv[2];
if(import.meta.url===new URL('file://'+process.argv[1]).href){
 try{
 if(mode==='preflight'){
  await identity();const vars=(await settings()).bindings;
  assert.equal(vars.find(b=>b.name==='SANITY_ALLOW_PRODUCTION_WRITES').text,'disabled');
  for(const name of ['OWNER_USERNAME','OWNER_PASSWORD_HASH','CREDENTIAL_VERSION','SANITY_API_TOKEN'])assert.ok(vars.some(b=>b.name===name&&b.type==='secret_text'));
  const d=await docs();assert.equal(d.length,1);assert.equal(d[0]._id,'drafts.'+id);
  const hooks=await sanity('/hooks/projects/3ahm0828');
  const s={startedAt:new Date().toISOString(),id,name:d[0].name,slug:d[0].slug.current,originalImages:d[0].images.map(i=>i.asset._ref),baseline:await baseline(),hookDigest:hash(hooks),attempts:[],checks:[],uploads:[]};
  await writeFile(statePath,JSON.stringify(s),{flag:'wx',mode:0o600});await persist(s);console.log('PASS personal accounts, four secrets, write-disabled gate, retained native draft and non-QA baseline');
 }else if(mode==='provision'){
  await identity();const s=await load();assert.ok(!s.credentialAttempted,'Do not repeat credential creation');
  assert.equal((await settings()).bindings.find(b=>b.name==='SANITY_ALLOW_PRODUCTION_WRITES').text,'disabled');
  s.credentialAttempted=true;await persist(s);
  const created=await sanity('/projects/3ahm0828/tokens',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:'ATELIER admin dedicated Stage 2 content Editor',roleName:'editor'})});
  const token=created.key;assert.equal(typeof token,'string');assert.notEqual(token,personal);
  s.dedicatedTokenId=created.id;s.dedicatedTokenLabel=created.label;await persist(s);
  const list=await sanity('/projects/3ahm0828/tokens');const entries=Array.isArray(list)?list:list.tokens;
  const metadata=entries.find(t=>t.id===created.id);assert.ok(metadata,'Dedicated token metadata missing');
  assert.deepEqual(metadata.roles.map(r=>r.name).sort(),['editor'],'Unexpected token grants: stop');
  s.dedicatedTokenRoles=['editor'];await persist(s);
  const installed=await cf('/accounts/'+account+'/workers/scripts/atelier-admin/secrets',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'SANITY_API_TOKEN',text:token,type:'secret_text'})});assert.equal(installed.success,true);
  s.credentialInstalledAt=new Date().toISOString();await persist(s);
  console.log('PASS dedicated project Editor token verified and installed as secret_text; production writes remain disabled. No secret saved locally.');
 }else if(mode==='audit'){
  const s=await load(),now=await baseline();const changed=Object.keys(s.baseline).filter(k=>now[k]!==s.baseline[k]);assert.equal(changed.length,0,'Pre-existing non-QA documents/assets changed');
  const added=Object.keys(now).filter(k=>!(k in s.baseline));assert.ok(added.every(k=>k.startsWith('image-'))&&added.length<=2);
  assert.equal(hash(await sanity('/hooks/projects/3ahm0828')),s.hookDigest,'Webhook configuration changed');
  s.audit={at:new Date().toISOString(),unchangedDocuments:Object.keys(s.baseline).length,newAssets:added,webhookUnchanged:true};await persist(s);console.log(JSON.stringify(s.audit));
 }else if(mode==='observe'){
  const s=await load();const d=await cf('/accounts/'+account+'/pages/projects/fashion-catalog-demo/deployments?per_page=10');
  const deployments=d.result.filter(x=>x.created_on>=s.startedAt).map(x=>({id:x.id,createdAt:x.created_on,status:x.latest_stage?.status,trigger:x.deployment_trigger?.type}));
  const log=await sanity('/hooks/projects/3ahm0828/R36YGqSQne0etYIU/attempts');const entries=Array.isArray(log)?log:log.attempts??[];
  const hooks=entries.filter(x=>x.createdAt>=s.startedAt).map(x=>({id:x.id,createdAt:x.createdAt,resultCode:x.resultCode,isFailure:x.isFailure}));
  const r=await fetch('https://fashion-catalog-demo.pages.dev/catalog/?qa='+Date.now(),{headers:{'Cache-Control':'no-cache'}}),html=await r.text();
  const o={at:new Date().toISOString(),deployments,hooks,publicStatus:r.status,containsQa:html.includes(s.slug),containsEditedName:!!s.editedName&&html.includes(s.editedName)};s.observations??=[];s.observations.push(o);await persist(s);console.log(JSON.stringify(o,null,2));
 }else throw new Error('Unknown control mode');
 }catch(e){console.error('Stage 2 stopped: '+(e.code??e.name)+'. No credentials displayed.');process.exitCode=1;}
}
