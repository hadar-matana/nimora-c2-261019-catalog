import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),esbuild=createRequire(require.resolve('wrangler'))('esbuild');
async function load(path){const built=await esbuild.build({entryPoints:[new URL(path,import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral'});return import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));}
const {visibleOptions,optionKey}=await load('../src/lib/catalog-options.ts');
assert.equal(optionKey('  One   SIZE  '),'one size');
assert.deepEqual(visibleOptions(['XS','S','CUSTOM'],['custom','Rare original']),['custom','Rare original','XS','S']);
const {changeOption}=await load('../worker/catalog-options.ts');
const original=globalThis.fetch;
let upstream=0, mode='conflict';
globalThis.fetch=async(url,options)=>{
 upstream++;
 if(new URL(url).pathname.includes('/data/query/'))return Response.json({result:[{_id:'atelier-admin-catalog-options',_type:'catalogOptions',_rev:'stale',sizes:['S'],colors:['שחור']}]});
 const {mutations}=JSON.parse(options.body);assert.equal(mutations.length,1);
 assert.deepEqual(mutations[0],{patch:{id:'atelier-admin-catalog-options',ifRevisionID:'stale',set:{sizes:['S','XXL']}}});
 return new Response('{}',{status:mode==='conflict'?409:500});
};
try{
 const env={SANITY_MODE:'fixture',SANITY_FIXTURE_ORIGIN:'http://127.0.0.1:3003'};
 await assert.rejects(changeOption(env,{kind:'sizes',action:'add',value:'XXL',siteSettings:{evil:true}}),e=>e.status===409);
 mode='failure';await assert.rejects(changeOption(env,{kind:'sizes',action:'add',value:'XXL'}),e=>e.status===502);
 assert.equal(upstream,4); // One read and one attempt each; no mutation retry.
 await assert.rejects(changeOption({SANITY_MODE:'production'}, {kind:'sizes',action:'add',value:'XXL'}),e=>e.status===403);
 assert.equal(upstream,4);
 console.log('PASS normalized equality, legacy-value visibility, fixed-ID/field allowlists, optimistic conflict, upstream failure and fail-closed writes');
}finally{globalThis.fetch=original;}
