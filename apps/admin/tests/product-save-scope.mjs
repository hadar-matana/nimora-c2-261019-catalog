import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),esbuild=createRequire(require.resolve('wrangler'))('esbuild');
const built=await esbuild.build({entryPoints:[new URL('../worker/sanity.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral'});
const {saveProduct}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].contents).toString('base64'));
const oldFetch=globalThis.fetch,asset='image-'+'a'.repeat(40)+'-100x100-jpg';let mutations;
globalThis.fetch=async(url,options)=>{
 const u=new URL(url);
 if(u.pathname.includes('/data/query/')){
  if(u.searchParams.get('query')==='*[_id in $ids]')return Response.json({result:[]});
  assert.match(u.searchParams.get('query'),/_id in \[\$id,\$draft\]/);
  assert.equal(JSON.parse(u.searchParams.get('$id')),'product-one');
  assert.equal(JSON.parse(u.searchParams.get('$draft')),'drafts.product-one');
  assert.deepEqual(JSON.parse(u.searchParams.get('$assetIds')),[asset]);
  return Response.json({result:{products:[{_id:'product-one',_type:'product',_rev:'revision-one',name:'Original',slug:{current:'original-slug'},collection:{_type:'reference',_ref:'collection-one'}}],categories:[{_id:'category-one',_type:'category'}],assets:[{_id:asset,_type:'sanity.imageAsset'}]}});
 }
 mutations=JSON.parse(options.body).mutations;return Response.json({transactionId:'saved-once'});
};
try{
 await saveProduct({SANITY_MODE:'fixture',SANITY_FIXTURE_ORIGIN:'http://127.0.0.1:3003',SANITY_PROJECT_ID:'fixture01',SANITY_DATASET:'catalog',SANITY_API_VERSION:'2025-02-19'},'product-one',{id:'product-one',name:'Changed',description:'Description',priceAgorot:10900,categoryId:'category-one',sizes:['S'],colors:['Black'],images:[{id:'one',assetId:asset,alt:'Original image'}],revision:{published:'revision-one',draft:null}},'publish');
 assert.equal(mutations.length,1);assert.equal(mutations[0].patch.id,'product-one');assert.equal(mutations[0].patch.ifRevisionID,'revision-one');assert.equal(mutations[0].patch.set.name,'Changed');assert.equal(mutations[0].patch.set.slug.current,'original-slug');assert.equal(mutations[0].patch.set.collection._ref,'collection-one');
 console.log('PASS bounded product-pair/image query, optimistic revision, single mutation, original slug and unrelated schema fields preserved');
}finally{globalThis.fetch=oldFetch;}
