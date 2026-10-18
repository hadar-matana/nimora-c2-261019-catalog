import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const esbuild = createRequire(require.resolve("wrangler"))("esbuild");
const result = await esbuild.build({
  entryPoints: [new URL("../worker/sanity.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
});
const { connection, view, saveProduct } = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].contents).toString("base64")
);
assert.deepEqual(view({
  products: [{ _id: "drafts.placeholder-test", _type: "product", _rev: "one", images: [null, { _key: "unfinished" }, { _key: "ready", asset: { _ref: "image-ready" } }] }],
  categories: [], assets: [{ _id: "image-ready", url: "https://example.invalid/image.png" }],
}, "placeholder-test").images.map(image => image.id), ["ready"]);
console.log("PASS unfinished Studio draft image placeholders do not break catalog reads");
let requests = 0;
const original = globalThis.fetch;
globalThis.fetch = () => {
  requests++;
  throw new Error("Network must not be used by gate checks");
};
try {
  for (const env of [
    {},
    { SANITY_API_TOKEN: "fixture-not-a-real-token" },
    { SANITY_PROJECT_ID: "fixture01", SANITY_DATASET: "production", SANITY_API_VERSION: "2025-02-19", SANITY_MODE: "production", SANITY_API_TOKEN: "fixture-not-a-real-token" },
  ])
    assert.throws(
      () => connection(env, true),
      (e) => [403, 503].includes(e.status),
    );
  for (const origin of [
    "https://other.example",
    "https://127.0.0.1:3003",
    "http://localhost:3003",
  ])
    assert.throws(
      () =>
        connection(
          { SANITY_PROJECT_ID: "fixture01", SANITY_DATASET: "production", SANITY_API_VERSION: "2025-02-19", SANITY_MODE: "fixture", SANITY_FIXTURE_ORIGIN: origin },
          true,
        ),
      (e) => e.status === 503,
    );
  assert.equal(
    connection(
      {
        SANITY_PROJECT_ID: "fixture01", SANITY_DATASET: "production", SANITY_API_VERSION: "2025-02-19", SANITY_MODE: "fixture",
        SANITY_FIXTURE_ORIGIN: "http://127.0.0.1:3003",
      },
      true,
    ).fixture,
    true,
  );
  assert.equal(requests, 0);
  console.log(
    "PASS live writes fail closed before network; fixture origin restricted to HTTP loopback; no real credentials loaded",
  );
} finally {
  globalThis.fetch = original;
}

// Real uploads can become available to a targeted read before a previous broad
// catalog result contains them. Resolve references without retrying mutations.
const assetId = "image-" + "a".repeat(40) + "-10x10-png";
let targetedReads = 0, committed = 0;
globalThis.fetch = async (address, options) => {
  const url = new URL(address);
  assert.equal(url.origin, "http://127.0.0.1:3003");
  if (url.pathname.includes("/data/query/")) {
    const q = url.searchParams.get("query");
    let result = [];
    if (q.startsWith('{"products":')) result = {
      products: [], categories: [{ _id: "category-one", _type: "category" }], assets: [],
    };
    else if (q.includes('_type=="sanity.imageAsset"')) {
      targetedReads++;
      result = [{ _id: assetId, _type: "sanity.imageAsset" }];
    }
    return Response.json({ result });
  }
  assert.ok(url.pathname.includes("/data/mutate/"));
  const mutations = JSON.parse(options.body).mutations;
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].create._id, "drafts.asset-gap-test");
  assert.equal(mutations[0].create.images[0].asset._ref, assetId);
  committed++;
  return Response.json({ transactionId: "fixture-only" });
};
try {
  await saveProduct({ SANITY_PROJECT_ID: "fixture01", SANITY_DATASET: "production", SANITY_API_VERSION: "2025-02-19", SANITY_MODE: "fixture", SANITY_FIXTURE_ORIGIN: "http://127.0.0.1:3003" }, "asset-gap-test", {
    id: "asset-gap-test", name: "QA product", description: "", priceAgorot: 100,
    categoryId: "category-one", sizes: [], colors: [], images: [{ id: "image-one", assetId, alt: "QA product" }],
    revision: { published: null, draft: null },
  }, "draft");
  assert.equal(targetedReads, 1);
  assert.equal(committed, 1);
  console.log("PASS newly uploaded references use a targeted read and exactly one draft mutation");
} finally { globalThis.fetch = original; }

const gateBuild = await esbuild.build({
  entryPoints: [new URL("../worker/access.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  format: "esm",
  platform: "neutral",
});
const { allowedHost } = await import(
  "data:text/javascript;base64," +
    Buffer.from(gateBuild.outputFiles[0].contents).toString("base64")
);
const remote = {
  LOCAL_COMPAT_PROOF: "0",
  ADMIN_ORIGIN: "https://approved.invalid",
  ADMIN_REMOTE_ENABLED: "approved",
  SANITY_PROJECT_ID: "fixture01", SANITY_DATASET: "production", SANITY_API_VERSION: "2025-02-19", SANITY_MODE: "production",
  SANITY_API_TOKEN: "fixture-only-not-real",
  OWNER_USERNAME: "fixture-owner",
  OWNER_PASSWORD_HASH: "$2b$12$" + "a".repeat(53),
  CREDENTIAL_VERSION: "fixture-version",
};
assert.equal(
  allowedHost(
    { LOCAL_COMPAT_PROOF: "1", ADMIN_ORIGIN: "http://127.0.0.1:3002" },
    "https://public.invalid/login",
  ),
  false,
);
assert.equal(
  allowedHost(
    { ...remote, ADMIN_REMOTE_ENABLED: "disabled" },
    "https://approved.invalid/login",
  ),
  false,
);
assert.equal(
  allowedHost(
    { ...remote, SANITY_PROJECT_ID: "fixture01", SANITY_DATASET: "production", SANITY_API_VERSION: "2025-02-19", SANITY_MODE: "fixture" },
    "https://approved.invalid/login",
  ),
  false,
);
assert.equal(
  allowedHost(
    { ...remote, OWNER_PASSWORD_HASH: "" },
    "https://approved.invalid/login",
  ),
  false,
);
assert.equal(allowedHost(remote, "http://approved.invalid/login"), false);
assert.equal(allowedHost(remote, "https://other.invalid/login"), false);
assert.equal(allowedHost(remote, "https://approved.invalid/login"), true);
console.log(
  "PASS disabled release template fails closed; explicit HTTPS origin, server credentials and production data mode required",
);

const policyBuild=await esbuild.build({entryPoints:[new URL("../worker/session-policy.ts",import.meta.url).pathname],bundle:true,write:false,format:"esm",platform:"neutral"});
const {sessionLifetime}=await import("data:text/javascript;base64,"+Buffer.from(policyBuild.outputFiles[0].contents).toString("base64"));
assert.equal(sessionLifetime({}),28_800_000);
assert.equal(sessionLifetime({SESSION_TTL_SECONDS:"120"}),120_000);
assert.equal(sessionLifetime({SESSION_TTL_SECONDS:"28800"}),28_800_000);
assert.equal(sessionLifetime({LOCAL_COMPAT_PROOF:"1",LOCAL_SESSION_TTL_MS:"1200"}),1200);
for(const invalid of ["0","59","28801","bad"])assert.throws(()=>sessionLifetime({SESSION_TTL_SECONDS:invalid}));
console.log("PASS bounded operator session lifetime; eight-hour default unchanged");

const appBuild=await esbuild.build({entryPoints:[new URL("../worker/index.ts",import.meta.url).pathname],bundle:true,write:false,format:"esm",platform:"node"});
const {default:app}=await import("data:text/javascript;base64,"+Buffer.from(appBuild.outputFiles[0].contents).toString("base64"));
const testCookie="a".repeat(64),testCsrf="b".repeat(64);
const readOnlyEnv={...remote,SANITY_ALLOW_PRODUCTION_WRITES:"disabled",AUTH:{idFromName:()=>"fixture",get:()=>({fetch:async request=>{
  const body=await request.json();return body.token===testCookie?Response.json({csrf:testCsrf,expires:Date.now()+10000}):Response.json({error:"unauthorized"},{status:401});
}})}};
globalThis.fetch=()=>{throw new Error("No upstream requests allowed in read-only mutation guard test");};
try {
  for(const path of ["/api/products/test","/api/categories","/api/uploads", "/api/catalog-options"]){
    const response=await app.fetch(new Request("https://approved.invalid"+path,{method:"POST",headers:{Cookie:"__Host-atelier_session="+testCookie,Origin:"https://approved.invalid","X-CSRF-Token":testCsrf},body:"not valid JSON or image"}),readOnlyEnv);
    assert.equal(response.status,403);assert.match((await response.json()).error,/לקריאה בלבד/);
  }
  const anonymous=await app.fetch(new Request("https://approved.invalid/api/catalog"),readOnlyEnv);assert.equal(anonymous.status,401);
  console.log("PASS authenticated Stage 1 writes blocked before body parsing/upstream access; anonymous reads rejected");
}finally{globalThis.fetch=original;}

const qaEnv={...readOnlyEnv,SANITY_ALLOW_PRODUCTION_WRITES:"approved",ADMIN_QA_PRODUCT_ID:"atelier-qa-20261015-0375d18c"};
globalThis.fetch=()=>{throw new Error("Controlled scope must reject before upstream access");};
try {
  for(const path of ["/api/products/real-product","/api/products/atelier-qa-20261015-0375d18c-extra","/api/categories", "/api/catalog-options"]){
    const r=await app.fetch(new Request("https://approved.invalid"+path,{method:"POST",headers:{Cookie:"__Host-atelier_session="+testCookie,Origin:"https://approved.invalid","X-CSRF-Token":testCsrf},body:"invalid"}),qaEnv);
    assert.equal(r.status,403);
  }
  for(const headers of [{},{Cookie:"__Host-atelier_session="+testCookie,Origin:"https://approved.invalid","X-CSRF-Token":"wrong"}]){
    const r=await app.fetch(new Request("https://approved.invalid/api/products/"+qaEnv.ADMIN_QA_PRODUCT_ID,{method:"POST",headers,body:"invalid"}),qaEnv);
    assert.equal(r.status,headers.Cookie?403:401);
  }
  console.log("PASS controlled activation rejects non-QA/category writes; owner authentication and CSRF remain mandatory");
}finally{globalThis.fetch=original;}

const uploadOnly={...readOnlyEnv,SANITY_UPLOAD_RETEST_UNTIL:String(Date.now()+600000)};
globalThis.fetch=()=>{throw new Error('No upstream access in upload-only gate probes');};
try{
 for(const path of ['/api/products/atelier-qa-20261015-0375d18c','/api/categories']){
  const r=await app.fetch(new Request('https://approved.invalid'+path,{method:'POST',headers:{Cookie:'__Host-atelier_session='+testCookie,Origin:'https://approved.invalid','X-CSRF-Token':testCsrf},body:'invalid'}),uploadOnly);assert.equal(r.status,403);
 }
 for(const headers of [{},{Cookie:'__Host-atelier_session='+testCookie,Origin:'https://approved.invalid','X-CSRF-Token':'wrong'}]){
  const r=await app.fetch(new Request('https://approved.invalid/api/uploads',{method:'POST',headers,body:'invalid'}),uploadOnly);assert.equal(r.status,headers.Cookie?403:401);
 }
 const r=await app.fetch(new Request('https://approved.invalid/api/uploads',{method:'POST',headers:{Cookie:'__Host-atelier_session='+testCookie,Origin:'https://approved.invalid','X-CSRF-Token':testCsrf,'Content-Type':'text/plain'},body:'invalid'}),uploadOnly);assert.equal(r.status,415);
 for(const until of [undefined,'disabled',String(Date.now()-1),String(Date.now()+7200000)]){
  const expired=await app.fetch(new Request('https://approved.invalid/api/uploads',{method:'POST',headers:{Cookie:'__Host-atelier_session='+testCookie,Origin:'https://approved.invalid','X-CSRF-Token':testCsrf},body:'invalid'}),{...uploadOnly,SANITY_UPLOAD_RETEST_UNTIL:until});assert.equal(expired.status,403);
 }
 console.log('PASS expiring upload-only retest gate preserves all content-write, owner and CSRF protections');
}finally{globalThis.fetch=original;}

// Production admits only the bounded upload transport verified on Workers Free.
const uploadBuild = await esbuild.build({entryPoints:[new URL('../worker/uploads.ts',import.meta.url).pathname],bundle:true,write:false,format:'esm',platform:'neutral'});
const {uploadImage} = await import('data:text/javascript;base64,'+Buffer.from(uploadBuild.outputFiles[0].contents).toString('base64'));
globalThis.fetch=()=>{throw new Error('Upload policy rejection must precede upstream access');};
try {
 const env={...remote,SANITY_ALLOW_PRODUCTION_WRITES:'approved'};
 for(const [length,status] of [[null,411],['2097153',413],['invalid',413]]) {
  const headers={'Content-Type':'image/png'};if(length!==null)headers['Content-Length']=length;
  await assert.rejects(uploadImage(new Request('https://approved.invalid/api/uploads',{method:'POST',headers,body:'fixture'}),env),e=>e.status===status);
 }
 const active={...readOnlyEnv,SANITY_ALLOW_PRODUCTION_WRITES:'approved',ADMIN_QA_PRODUCT_ID:''};
 for(const path of ['/api/products/fixture','/api/categories','/api/uploads','/api/catalog-options','/api/site-settings']) {
  for(const authenticated of [false,true]) {
   const headers=authenticated?{Cookie:'__Host-atelier_session='+testCookie,Origin:'https://approved.invalid','X-CSRF-Token':'invalid'}:{};
   assert.equal((await app.fetch(new Request('https://approved.invalid'+path,{method:'POST',headers,body:'{}'}),active)).status,authenticated?403:401);
  }
 }
 assert.equal((await app.fetch(new Request('https://approved.invalid/api/site-settings',{method:'POST',headers:{Cookie:'__Host-atelier_session='+testCookie,Origin:'https://approved.invalid','X-CSRF-Token':testCsrf},body:'{}'}),active)).status,405);
 console.log('PASS production rejects unknown/oversized upload lengths; activated routes retain authentication, CSRF and forbidden-settings guards');
} finally {globalThis.fetch=original;}
