import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url), esbuild=createRequire(require.resolve('wrangler'))('esbuild');
const built=await esbuild.build({entryPoints:[new URL('../worker/about.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral'});
const {readAbout,saveAbout}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const env={SANITY_MODE:'fixture',SANITY_FIXTURE_ORIGIN:'http://127.0.0.1:3003'};
const original=globalThis.fetch;
let docs=[], mutations=[], fail=false;
globalThis.fetch=async(url,options)=>{
  if(new URL(url).pathname.includes('/data/query/')) {
    const q=new URL(url).searchParams.get('query');
    assert.ok(q.includes('siteSettings') && q.includes('drafts.**') && q.includes('versions.**') && q.includes('order(_id asc)'));
    return Response.json({result:docs});
  }
  const batch=JSON.parse(options.body).mutations;mutations.push(batch);
  if(fail) return new Response('{}',{status:409});
  const {patch}=batch[0]; assert.equal(patch.ifRevisionID,docs[0]._rev);
  docs=[{...docs[0],...patch.set,_rev:'next-revision'}];
  return Response.json({transactionId:'test-transaction'});
};
const input={heading:' הסיפור שלנו ',intro:'פתיח',body:'פסקה ראשונה\n\nפסקה שנייה',revision:'original'};
try {
 assert.deepEqual(await readAbout(env),{revision:null,heading:'',intro:'',body:'',editable:false});
 await assert.rejects(saveAbout(env,input),e=>e.status===409);assert.equal(mutations.length,0);
 docs=[{_id:'real-settings-id',_type:'siteSettings',_rev:'original',displayName:'Existing brand',whatsappNumber:'untouched',nested:{keep:true}}];
 const saved=await saveAbout(env,input);
 assert.equal(saved.heading,'הסיפור שלנו');assert.equal(saved.body,input.body);assert.equal(saved.revision,'next-revision');
 assert.deepEqual(mutations[0],[{patch:{id:'real-settings-id',ifRevisionID:'original',set:{aboutHeading:'הסיפור שלנו',aboutIntro:'פתיח',aboutBody:input.body}}}]);
 assert.equal(docs[0].displayName,'Existing brand');assert.deepEqual(docs[0].nested,{keep:true});
 assert.deepEqual(await readAbout(env),saved);
 await assert.rejects(saveAbout(env,input),e=>e.status===409);
 for(const bad of [null, [], {...input,heading:'x'.repeat(121)},{...input,body:'x'.repeat(12001)},{...input,body:42},{...input,extra:'bad'},{...input,heading:'\0'}]) await assert.rejects(saveAbout(env,bad),e=>e.status===400);
 fail=true;await assert.rejects(saveAbout(env,{...input,revision:'next-revision'}),e=>e.status===409);fail=false;
 await assert.rejects(saveAbout({SANITY_MODE:'production'},input),e=>e.status===403);
 docs.push({...docs[0],_id:'other-settings'});await assert.rejects(readAbout(env),e=>e.status===409);
 docs=[docs[0]];const cleared=await saveAbout(env,{heading:'',intro:'',body:'',revision:'next-revision'});assert.equal(cleared.body,'');
 const worker=await readFile(new URL('../worker/index.ts',import.meta.url),'utf8');
 assert.ok(worker.includes('app.post("/api/about"'));assert.ok(worker.includes('c.req.path.startsWith("/api/about")'));
 assert.ok(worker.includes('about(?:\\/|$)')); // Same read-only gate as products.
 const storefront=await readFile(new URL('../../storefront/src/lib/queries.ts',import.meta.url),'utf8');
 for(const field of ['aboutHeading','aboutIntro','aboutBody'])assert.ok(storefront.includes(field));
 const schema=await readFile(new URL('../../studio/schemaTypes/siteSettings.ts',import.meta.url),'utf8');
 for(const field of ['aboutHeading','aboutIntro','aboutBody']) assert.equal(schema.split('name: \"'+field+'\"').length-1,1,'About fields belong only at settings document level');
 const page=await readFile(new URL('../../storefront/src/app/about/page.tsx',import.meta.url),'utf8');assert.ok(page.includes('עוד מעט נשתף'));assert.ok(page.includes('canonical'));
 console.log('PASS About read/save/reload, paragraphs, exact patch preservation, revision conflicts, limits, unknown fields, read-only mode, ambiguous/missing settings, clearing, route guards and storefront projection');
} finally {globalThis.fetch=original;}
