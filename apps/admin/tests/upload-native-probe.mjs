// Local workerd unit harness. Never deployed; replaces fetch with an in-memory
// upload sink. No real credentials or production network access is possible.
import assert from 'node:assert/strict';
import {uploadImage} from '../worker/uploads';
const assetId='image-'+ 'a'.repeat(40)+'-1x1-png';
const env={SANITY_MODE:'fixture',SANITY_FIXTURE_ORIGIN:'http://127.0.0.1:3003'};
const probe = {async fetch(){
 const original=globalThis.fetch,checks=[];
 const bytes=new Uint8Array(128);bytes.set([137,80,78,71,13,10,26,10]);
 let sinkBytes=0,cancelled=false,mode='normal',signalSeen;
 globalThis.fetch=async (_url,options)=>{
  signalSeen=options.signal;
  if(mode==='early')return Response.json({document:{}});
  if(mode==='timeout')return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('timeout')),{once:true}));
  const reader=options.body.getReader();let n=0;
  const aborted=()=>{void reader.cancel().catch(()=>{});};
  options.signal.addEventListener('abort',aborted,{once:true});
  if(options.signal.aborted)aborted();
  try{while(true){const p=await Promise.race([reader.read(),new Promise((_,reject)=>{if(options.signal.aborted)reject(new Error('aborted'));else options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true});})]);if(p.done)break;n+=p.value.length;}}
  finally{options.signal.removeEventListener('abort',aborted);try{reader.releaseLock();}catch{ /* canceled native read may still settle */ }}
  sinkBytes=n;
  if(mode==='oversized-response')return new Response('x'.repeat(65537));
  if(mode==='malformed-response')return new Response('{');
  const document={_id:assetId,_type:'sanity.imageAsset',url:'http://127.0.0.1:3003/images/'+assetId.slice(6).replace(/-png$/,'.png'),size:n,mimeType:'image/png',metadata:{dimensions:{width:1,height:1}}};
  if(mode==='wrong-dimensions')document.metadata.dimensions.width=50_000_000;
  if(mode==='wrong-mime')document.mimeType='image/jpeg';
  if(mode==='wrong-size')document.size=n+1;
  return Response.json({document});
 };
 const make=(length,parts=[bytes],signal)=>new Request('http://127.0.0.1/upload',{method:'POST',headers:{'Content-Type':'image/png',...(length===null?{}:{'Content-Length':String(length)})},body:new ReadableStream({pull(c){const p=parts.shift();if(p)c.enqueue(p);else c.close();},cancel(){cancelled=true;}}),signal});
 const check=async(label,fn)=>{console.log('Local probe: '+label);sinkBytes=0;cancelled=false;await fn();checks.push(label);};
 try{
  await check('Known length: fragmented signature, exact size and editor-compatible DTO',async()=>{const v=await uploadImage(make(128,[bytes.slice(0,2),bytes.slice(2,6),bytes.slice(6,12),bytes.slice(12)]),env);assert.equal(v.bytes,128);assert.equal(sinkBytes,128);assert.equal(v.assetId,assetId);assert.ok(v.id&&v.src&&v.alt==='');});
  for(const [label,length]of [['short',129],['long',127],['zero',0]])await check('Known length '+label+' rejected',async()=>{await assert.rejects(uploadImage(make(length),env),e=>e.status===400||e.status===502);});
  for(const length of ['not-a-length','9007199254740993','10485761'])await check('Invalid/oversized declared length '+length+' rejected',async()=>{await assert.rejects(uploadImage(make(length),env),e=>e.status===413);});
  await check('Already aborted request rejected before upload',async()=>{const c=new AbortController();c.abort();await assert.rejects(uploadImage(make(128,[bytes],c.signal),env),e=>e.status===499);});
  await check('Known length mid-transfer abort cancels upstream',async()=>{
   const c=new AbortController();let first=true,closedAfterAbort=false;
   const body=new ReadableStream({async pull(ctrl){if(first){first=false;ctrl.enqueue(bytes.slice(0,12));}else{await new Promise(r=>setTimeout(r,30));if(!c.signal.aborted)ctrl.enqueue(bytes.slice(12));else{closedAfterAbort=true;ctrl.close();}}},cancel(){cancelled=true;}});
   const timer=setTimeout(()=>c.abort(),10);
   try{await assert.rejects(uploadImage(new Request('http://127.0.0.1/upload',{method:'POST',headers:{'Content-Type':'image/png','Content-Length':'128'},body,signal:c.signal}),env),e=>e.status===499);assert.ok(signalSeen.aborted);await new Promise(r=>setTimeout(r,40));assert.ok(cancelled||closedAfterAbort,'Source must cancel or close after abort');}finally{clearTimeout(timer);}
  });
  await check('60-second deadline aborts upstream and returns 504 (timer accelerated only in test)',async()=>{
   const timer=globalThis.setTimeout;mode='timeout';
   globalThis.setTimeout=(callback,delay,...args)=>timer(callback,delay===60000?10:delay,...args);
   try{await assert.rejects(uploadImage(make(128),env),e=>e.status===504);assert.ok(signalSeen.aborted);}finally{globalThis.setTimeout=timer;mode='normal';}
  });
  for(const m of ['early','oversized-response','malformed-response','wrong-dimensions','wrong-mime','wrong-size'])await check('Safe rejection: '+m,async()=>{mode=m;await assert.rejects(uploadImage(make(128),env),e=>e.status===502);});
  return Response.json({passed:true,checks});
 }catch(e){return Response.json({passed:false,checks,error:e.message},{status:500});}finally{globalThis.fetch=original;}
}};

export default probe;
