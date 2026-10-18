import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {cmsTarget, brandConfig, deploymentKind, publicUrl} from '../../../packages/config/deployment.mjs';
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve('wrangler'))('esbuild');
async function load(file) {
  const result = await esbuild.build({entryPoints:[new URL(file, import.meta.url).pathname], bundle:true, write:false, format:'esm', platform:'neutral'});
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].contents).toString('base64'));
}
const {connection, query, mutate} = await load('../worker/sanity.ts');
const {uploadImage} = await load('../worker/uploads.ts');
const base = {SANITY_MODE:'production', SANITY_PROJECT_ID:'client01', SANITY_DATASET:'catalog', SANITY_API_VERSION:'2025-02-19', SANITY_API_TOKEN:'test-only-token', SANITY_ALLOW_PRODUCTION_WRITES:'approved'};
const original = globalThis.fetch;
const seen = [];
globalThis.fetch = async (url, options) => {
  seen.push(String(url));
  assert.equal(options.headers.Authorization, 'Bearer test-only-token');
  return String(url).includes('/query/') ? Response.json({result:[]}) : Response.json({transactionId:'isolated'});
};
try {
  for (const project of ['client01', 'client02']) {
    const env = {...base, SANITY_PROJECT_ID:project, SANITY_DATASET:project === 'client01' ? 'catalog' : 'staging'};
    await query(env, '*[]'); await mutate(env, []);
    assert.ok(seen.at(-1).startsWith(`https://${project}.api.sanity.io/v2025-02-19/data/mutate/${env.SANITY_DATASET}?`));
    assert.equal(connection(env).assetPrefix, `https://cdn.sanity.io/images/${project}/${env.SANITY_DATASET}/`);
  }
  const before = seen.length;
  for (const field of ['SANITY_PROJECT_ID','SANITY_DATASET','SANITY_API_VERSION']) {
    for (const value of [undefined, '', '../production', 'bad/path', 'https://evil.invalid']) {
      const env = {...base, [field]:value};
      await assert.rejects(query(env,'*[]'));
      await assert.rejects(mutate(env,[]));
      await assert.rejects(uploadImage(new Request('http://127.0.0.1/upload',{method:'POST',body:'x'}),env));
    }
  }
  for (const date of ['2025-02-30','2025-13-01','v2025-02-19']) assert.throws(()=>cmsTarget('client01','catalog',date));
  for (const mode of [undefined,'','typo']) assert.throws(()=>connection({...base,SANITY_MODE:mode},true));
  assert.equal(seen.length,before,'Invalid targets must make zero network requests');
  assert.ok(seen.every(url=>!url.includes('3ahm0828')));
  // Exercise the real streaming upload validator against a cross-project CDN response.
  const png = new Uint8Array([137,80,78,71,13,10,26,10,0,0,0,0]);
  const assetId = 'image-'+'a'.repeat(40)+'-1x1-png';
  const filename = 'a'.repeat(40)+'-1x1.png';
  const env = {...base, SANITY_MODE:'fixture', SANITY_FIXTURE_ORIGIN:'http://127.0.0.1:3003'};
  for (const assetUrl of ['http://127.0.0.1:3003/images/'+filename, 'https://cdn.sanity.io/images/3ahm0828/production/'+filename, 'http://127.0.0.1:3003/images/'+filename+'?evil=1']) {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:3003/v2025-02-19/assets/images/catalog');
      await new Response(options.body).arrayBuffer();
      return Response.json({document:{_id:assetId,_type:'sanity.imageAsset',url:assetUrl,size:png.length,mimeType:'image/png',metadata:{dimensions:{width:1,height:1}}}});
    };
    const request = new Request('http://127.0.0.1/upload',{method:'POST',headers:{'Content-Type':'image/png'},body:png});
    if (assetUrl === 'http://127.0.0.1:3003/images/'+filename) assert.equal((await uploadImage(request,env)).src,assetUrl);
    else await assert.rejects(uploadImage(request,env), e=>e.status===502);
  }
  for (const input of [undefined,'', 'production']) assert.throws(()=>deploymentKind(input));
  for (const input of [undefined,'javascript:alert(1)','https://user:pass@example.com']) assert.throws(()=>publicUrl(input,'test URL'));
  assert.throws(()=>brandConfig('client',{}));
  assert.throws(()=>brandConfig('client',{displayName:'Client',description:'Fashion',accentColor:'red;display:none'}));
  assert.equal(brandConfig('client',{displayName:'Brand One',description:'One'}).name,'Brand One');
  assert.equal(brandConfig('client',{displayName:'Brand Two',description:'Two'}).name,'Brand Two');
  assert.deepEqual(brandConfig('demo',{displayName:'Legacy CMS name',accentColor:'#ffffff'}),brandConfig('demo'));
  console.log('PASS distinct targets, no-network invalid reads/writes/uploads, mode validation, streaming asset URL rejection, client identity and exact demo branding');
} finally {globalThis.fetch=original;}
