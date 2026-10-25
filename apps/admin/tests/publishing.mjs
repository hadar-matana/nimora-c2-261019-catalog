import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),esbuild=createRequire(require.resolve('wrangler'))('esbuild');
const built=await esbuild.build({entryPoints:[new URL('../worker/publishing.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral'});
const {PublishingQueue,publishingTarget}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const env={PUBLISHING_ENABLED:'approved',PUBLISHING_PROJECT_ID:'testclient',SANITY_PROJECT_ID:'testclient',PUBLISHING_DATASET:'catalog',SANITY_DATASET:'catalog',SANITY_API_VERSION:'2025-02-19',PUBLISHING_PAGES_PROJECT:'testclient-store',PUBLISHING_HOOK_ID:'12345678-1234-1234-1234-123456789abc',PUBLISHING_HOOK_URL:'https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/12345678-1234-1234-1234-123456789abc'};
for(const patch of [{SANITY_PROJECT_ID:'other'},{SANITY_DATASET:'other'},{PUBLISHING_ENABLED:'disabled'},{PUBLISHING_PAGES_PROJECT:'../other'},{PUBLISHING_HOOK_URL:env.PUBLISHING_HOOK_URL+'?secret=x'},{PUBLISHING_HOOK_URL:'http://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/'+env.PUBLISHING_HOOK_ID},{PUBLISHING_HOOK_URL:'https://evil.example/'+env.PUBLISHING_HOOK_ID},{PUBLISHING_HOOK_ID:'87654321-1234-1234-1234-123456789abc'}])assert.throws(()=>publishingTarget({...env,...patch}));
const originalFetch=globalThis.fetch,originalNow=Date.now;
let time=1000000,revision='one',live=null,hooks=0,fail=false,lastFingerprint;
Date.now=()=>time;
globalThis.fetch=async(url,init)=>{
  const u=new URL(url);
  if(u.hostname==='testclient.api.sanity.io'){
    assert.equal(u.searchParams.get('perspective'),'published');assert.match(u.searchParams.get('query'),/drafts\.\*\*/);assert.match(u.searchParams.get('query'),/versions\.\*\*/);
    return Response.json({result:[{_id:'product-one',_rev:revision}]});
  }
  if(u.pathname==='/publication.json')return live?Response.json(live):new Response(null,{status:404});
  assert.equal(u.href,env.PUBLISHING_HOOK_URL);assert.equal(init.method,'POST');assert.equal(init.redirect,'error');hooks++;if(fail)throw Error('secret-provider-message');return Response.json({success:true});
};
function fixture(){const rows=new Map();const storage={get:async k=>rows.get(k),put:async(k,v)=>rows.set(k,structuredClone(v)),setAlarm:async n=>{storage.alarm=n;},transaction:async fn=>fn(storage)};return {queue:new PublishingQueue({storage},env),storage,rows};}
const request=(queue,path)=>queue.fetch(new Request('https://internal/publication/'+path,{method:'POST'}));
try{
  const {queue,rows}=fixture();
  await request(queue,'prepare');await request(queue,'commit');await request(queue,'commit');await queue.alarm();assert.equal(hooks,1);assert.equal(rows.get('publication').phase,'building');lastFingerprint=rows.get('publication').fingerprint;
  await queue.alarm();assert.equal(hooks,1,'polling cannot duplicate a trigger');
  revision='two';time+=1000;await request(queue,'commit');await queue.alarm();assert.equal(hooks,1,'concurrent edits wait for existing build');
  live={projectId:'testclient',dataset:'catalog',fingerprint:lastFingerprint};await queue.alarm();assert.equal(hooks,2,'one follow-up build includes newer changes');
  live.fingerprint=rows.get('publication').fingerprint;await queue.alarm();assert.equal(rows.get('publication').phase,'live');assert.equal(hooks,2);
  time+=121000;await queue.alarm();assert.equal(rows.get('publication').phase,'live');assert.equal(hooks,2);
  const status=await (await request(queue,'status')).text();assert.ok(!status.includes(env.PUBLISHING_HOOK_URL));assert.ok(!status.includes('secret-provider-message'));
  revision='three';await request(queue,'commit');fail=true;await queue.alarm();assert.equal(rows.get('publication').phase,'error');const count=hooks;fail=false;
  // No alarm is scheduled on failure. An explicit owner retry starts one attempt.
  await request(queue,'retry');await queue.alarm();assert.equal(hooks,count+1);
  time+=601000;await queue.alarm();assert.equal(rows.get('publication').error,'deployment-timeout');assert.equal(hooks,count+1);
  console.log('PASS strict target/capability validation, published-only fingerprint, debounce, duplicate triggers, concurrent updates, live marker, sanitized errors, bounded timeout and explicit retry');
}finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
