import "./legacy-demo-only.mjs";
// Explicitly approved initial deployment. Never retries provisioning requests.
// No credentials, session headers or raw API responses are logged or persisted.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
const account = "07eb45a2b5a037d1138beea811cf549b";
const name = "atelier-admin";
const accountPath = `/accounts/${account}`;
const workerPath = `${accountPath}/workers/scripts/${name}`;
const reportPath = new URL("../../../docs/admin-screenshots/stage1-provisioning.json", import.meta.url);
const lockPath = "/private/tmp/atelier-stage1-initial-attempt.json";
const config = await readFile(homedir()+"/Library/Preferences/.wrangler/config/default.toml", "utf8");
const token = config.match(/^oauth_token\s*=\s*"([^"\n]+)"/m)?.[1];
assert.ok(token, "Existing Cloudflare credential required");
async function request(path, options = {}) {
  const response = await fetch("https://api.cloudflare.com/client/v4"+path, {
    ...options, headers: { Authorization: "Bearer "+token, ...options.headers },
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  return { status: response.status, success: !!data.success, result: data.result, codes: (data.errors??[]).map(e=>e.code) };
}
async function identity() {
  const user = await request("/user");
  assert.equal(user.status,200);assert.equal(user.result.email,"hadarmat@gmail.com");
}
async function inventory() {
  const workers = await request(accountPath+"/workers/scripts");
  const namespaces = await request(accountPath+"/workers/durable_objects/namespaces");
  const settings = await request(workerPath+"/settings");
  const subdomain = await request(workerPath+"/subdomain");
  return {
    at: new Date().toISOString(),
    workers: {status:workers.status,items:workers.result?.map(w=>({id:w.id,migration_tag:w.migration_tag,usage_model:w.usage_model}))},
    namespaces: {status:namespaces.status,items:namespaces.result?.map(n=>({id:n.id,name:n.name,script:n.script,class:n.class,use_sqlite:n.use_sqlite}))},
    settings: {status:settings.status,migration_tag:settings.result?.migration_tag,bindings:settings.result?.bindings?.map(b=>({name:b.name,type:b.type,class_name:b.class_name,namespace_id:b.namespace_id,...(b.type==="plain_text"&&["LOCAL_COMPAT_PROOF","ADMIN_REMOTE_ENABLED","ADMIN_ORIGIN","SANITY_MODE","SANITY_ALLOW_PRODUCTION_WRITES","SESSION_TTL_SECONDS"].includes(b.name)?{text:b.text}:{})})),observability:settings.result?.observability},
    subdomain: {status:subdomain.status,...subdomain.result},
  };
}
if(process.argv[2]==="initial") {
  await identity();
  const before=await inventory();
  assert.equal(before.workers.status,200);assert.equal(before.namespaces.status,200);
  assert.ok(!before.workers.items.some(w=>w.id===name),"Existing Worker: do not repeat initial deployment");
  assert.equal(before.namespaces.items.length,0,"Unexpected namespace inventory; stop");
  const code=await readFile("/private/tmp/atelier-admin-initial-bundle/index.js","utf8");
  const privateVars={LOCAL_COMPAT_PROOF:"0",ADMIN_REMOTE_ENABLED:"disabled",ADMIN_ORIGIN:"https://atelier-admin.hadarmat.workers.dev",SANITY_MODE:"production",SANITY_ALLOW_PRODUCTION_WRITES:"disabled"};
  const metadata={main_module:"index.js",compatibility_date:"2026-10-13",compatibility_flags:["nodejs_compat"],bindings:[{type:"durable_object_namespace",name:"AUTH",class_name:"OwnerAuth"},...Object.entries(privateVars).map(([name,text])=>({type:"plain_text",name,text}))],migrations:{new_tag:"v1",steps:[{new_sqlite_classes:["OwnerAuth"]}]},observability:{enabled:false}};
  const form=new FormData();
  form.set("metadata",new Blob([JSON.stringify(metadata)],{type:"application/json"}));
  form.set("index.js",new Blob([code],{type:"application/javascript+module"}),"index.js");
  const record={startedAt:new Date().toISOString(),personalIdentityVerified:true,freePlanVerifiedInDashboard:true,initialUploadRequests:1,publicAccess:"disabled",sanityWrites:"disabled",before};
  await writeFile(lockPath,JSON.stringify(record),{mode:0o600,flag:"wx"});
  try {
    const upload=await request(workerPath,{method:"PUT",body:form});
    record.upload={status:upload.status,success:upload.success,codes:upload.codes,migration_tag:upload.result?.migration_tag,deployment_id:upload.result?.deployment_id};
    if(upload.success) {
      const disable=await request(workerPath+"/subdomain",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({enabled:false,previews_enabled:false})});
      record.disablePublicRouting={status:disable.status,success:disable.success};
    }
  } catch(error) {record.networkFailure={name:error.name};}
  // Always inspect partial resources, even when the single upload failed.
  record.after=await inventory();
  record.accepted=record.upload?.success===true && record.after.workers.items?.some(w=>w.id===name&&w.migration_tag==="v1") && record.after.namespaces.items?.some(n=>n.script===name&&n.class==="OwnerAuth"&&n.use_sqlite===true);
  await writeFile(reportPath,JSON.stringify(record,null,2)+"\n");
  await writeFile(lockPath,JSON.stringify(record),{mode:0o600});
  console.log(JSON.stringify(record,null,2));
  if(!record.accepted) process.exitCode=1;
} else if(process.argv[2]==="reconcile") {
  await identity();
  const record=JSON.parse(await readFile(lockPath,"utf8"));
  assert.equal(record.upload?.success,true,"No retry of a failed deployment");
  record.after=await inventory();
  record.accepted=record.after.workers.items?.some(w=>w.id===name&&w.migration_tag==="v1") && record.after.namespaces.items?.some(n=>n.script===name&&n.class==="OwnerAuth"&&n.use_sqlite===true);
  await writeFile(reportPath,JSON.stringify(record,null,2)+"\n");
  await writeFile(lockPath,JSON.stringify(record),{mode:0o600});
  console.log(JSON.stringify({accepted:record.accepted,uploadRequests:record.initialUploadRequests,after:record.after},null,2));
} else if(process.argv[2]==="inventory") {
  await identity();console.log(JSON.stringify(await inventory(),null,2));
} else throw new Error("Use initial once, or read-only inventory");
