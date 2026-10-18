import "../scripts/legacy-demo-only.mjs";
// Explicitly authorized, single-product QA only. Never run the fixture suites
// against this server. No token, deploy-hook URL or session is written to reports.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

const root = new URL("../../../", import.meta.url);
const statePath = "/private/tmp/atelier-live-qa-state.json";
const sessionPath = "/private/tmp/atelier-live-qa-session.json";
const reportPath = new URL("docs/admin-screenshots/live-sanity-qa.json", root);
const varsPath = new URL("../worker/.dev.vars", import.meta.url);
const backupPath = "/private/tmp/atelier-live-qa-vars-backup";
const project = "3ahm0828", account = "07eb45a2b5a037d1138beea811cf549b";
const api = `https://${project}.api.sanity.io/v2025-02-19`;
const base = "http://127.0.0.1:3002";
const site = "https://fashion-catalog-demo.pages.dev";
const token = JSON.parse(await readFile(homedir()+"/.config/sanity/config.json", "utf8")).authToken;
const cfConfig = await readFile(homedir()+"/Library/Preferences/.wrangler/config/default.toml", "utf8");
const cfToken = cfConfig.match(/^oauth_token\s*=\s*"([^"\n]+)"/m)?.[1];
const mode = process.argv[2];
let state;
try { state = JSON.parse(await readFile(statePath,"utf8")); } catch {}
async function persist() {
  await writeFile(statePath,JSON.stringify(state,null,2),{mode:0o600});
  await writeFile(reportPath,JSON.stringify(state,null,2)+"\n");
}
async function sanity(path) {
  const r=await fetch(api+path,{headers:{Authorization:"Bearer "+token},signal:AbortSignal.timeout(30000)});
  if(!r.ok) throw new Error(`Sanity GET ${path.split("?")[0]} returned ${r.status}`);
  return r.json();
}
async function query(query,params={},authenticated=true,perspective="raw") {
  const url=new URL(api+"/data/query/production");
  url.searchParams.set("query",query);url.searchParams.set("perspective",perspective);
  for(const [k,v] of Object.entries(params)) url.searchParams.set("$"+k,JSON.stringify(v));
  const r=await fetch(url,{headers:authenticated?{Authorization:"Bearer "+token}:{},signal:AbortSignal.timeout(30000)});
  assert.equal(r.status,200,"Sanity query status");return (await r.json()).result;
}
async function cf(path) {
  const r=await fetch("https://api.cloudflare.com/client/v4"+path,{headers:{Authorization:"Bearer "+cfToken},signal:AbortSignal.timeout(30000)});
  const data=await r.json();
  if(!r.ok) return {status:r.status,errorCodes:data.errors?.map(e=>e.code)};
  return {status:r.status,result:data.result};
}
const digest=docs=>createHash("sha256").update(JSON.stringify(docs.sort((a,b)=>a._id.localeCompare(b._id)))).digest("hex");
async function existing() {
  return query('*[!(_id in $ids) && !(_type in ["sanity.imageAsset","sanity.fileAsset"]) ]', {ids:state?[state.id,"drafts."+state.id]:[]});
}
async function apiRequest(path,body) {
  assert.ok(path==="/api/catalog"||path==="/api/uploads"||path===`/api/products/${state.id}`||path===`/api/products/${state.id}/preview`,"Single-product route restriction");
  const session=JSON.parse(await readFile(sessionPath,"utf8"));
  const r=await fetch(base+path,{method:body?"POST":"GET",headers:{Cookie:session.cookie,Origin:base,"X-CSRF-Token":session.csrf,...(body?{"Content-Type":"application/json"}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(60000)});
  const data=await r.json();
  if(!r.ok)throw new Error(`Admin ${path} returned ${r.status}: ${data.error}`);
  return data;
}
async function current() { return (await apiRequest("/api/catalog")).products.find(p=>p.id===state.id); }
async function save(action,product) {
  assert.equal(product.id,state.id);assert.ok(product.name.includes("QA"));
  state.attempts.push({action,at:new Date().toISOString()}); await persist();
  await apiRequest(`/api/products/${state.id}`,{action,product});
  state.events.push({action,at:new Date().toISOString()});await persist();
}
async function docs() {return query('*[_id in $ids]',{ids:[state.id,"drafts."+state.id]});}

if(mode==="preflight") {
  assert.ok(!state,"A QA state already exists; reuse its ONE product rather than create another");
  const user=await sanity("/users/me");
  assert.equal(user.email,"hadarmat@gmail.com","Sanity personal identity mismatch");
  const cfUser=await cf("/user");
  if(cfUser.status===200) assert.equal(cfUser.result.email,"hadarmat@gmail.com","Cloudflare identity mismatch");
  const categories=await query('*[_type=="category" && !(_id in path("drafts.**"))]|order(sortOrder asc){_id,name}');
  assert.ok(categories.length);
  const hooks=await sanity(`/hooks/projects/${project}`);
  const hookList=Array.isArray(hooks)?hooks:(hooks.hooks??[]);
  const sanitizedHooks=hookList.map(h=>({id:h.id,name:h.name,dataset:h.dataset,type:h.type,disabled:!!(h.isDisabled||h.isDisabledByUser),includeDrafts:h.includeDrafts,rule:h.rule,targetHost:new URL(h.url).hostname}));
  const deployments=await cf(`/accounts/${account}/pages/projects/fashion-catalog-demo/deployments?per_page=5`);
  const baseline=await existing();
  state={startedAt:new Date().toISOString(),id:"atelier-qa-20261015-"+randomBytes(4).toString("hex"),name:"ATELIER QA — בדיקת אינטגרציה זמנית 15.10.2026",category:categories[0],personalSanityIdentityVerified:true,personalCloudflareIdentityVerified:cfUser.status===200,cloudflareReadStatus:deployments.status,baselineDigest:digest(baseline),baselineDocumentCount:baseline.length,hooks:sanitizedHooks,baselineDeployments:deployments.result?.map(d=>({id:d.id,created_on:d.created_on,status:d.latest_stage?.status,environment:d.environment})),assets:[],attempts:[],events:[]};
  await persist(); console.log(JSON.stringify(state,null,2));
} else {
  assert.ok(state && /^atelier-qa-20261015-[a-f0-9]{8}$/.test(state.id),"Run read-only preflight first");
  if(mode==="setup") {
    assert.equal((await docs()).length,0,"QA identity already exists; do not recreate");
    await writeFile(backupPath,await readFile(varsPath),{mode:0o600,flag:"wx"});
    const username="qa-owner-"+randomBytes(4).toString("hex"),password=randomBytes(24).toString("base64url");
    await writeFile(sessionPath,JSON.stringify({username,password}),{mode:0o600});
    const vars=`OWNER_USERNAME=${username}\nOWNER_PASSWORD_HASH=${await bcrypt.hash(password,12)}\nCREDENTIAL_VERSION=${randomUUID()}\nSANITY_MODE=production\nSANITY_API_TOKEN=${token}\nSANITY_ALLOW_PRODUCTION_WRITES=approved\n`;
    await writeFile(varsPath,vars,{mode:0o600});
    console.log("Local loopback-only server credentials configured privately; no remote secrets or permissions changed.");
  } else if(mode==="login") {
    const s=JSON.parse(await readFile(sessionPath,"utf8"));
    const r=await fetch(base+"/api/login",{method:"POST",headers:{Origin:base,"Content-Type":"application/json"},body:JSON.stringify({username:s.username,password:s.password})});
    assert.equal(r.status,200); const body=await r.json();
    await writeFile(sessionPath,JSON.stringify({...s,cookie:r.headers.get("set-cookie").split(";")[0],csrf:body.csrf}),{mode:0o600});
    assert.equal((await apiRequest("/api/catalog")).environment,"sanity");console.log("Authenticated local Worker connects to real Sanity.");
  } else if(mode==="draft" || mode==="resume-draft") {
    if(mode==="draft") assert.equal(state.attempts.length,0,"No automatic repeat of live writes");
    else {assert.equal((await docs()).length,0,"Do not recreate existing QA content");assert.equal(state.assets.length,2,"Reuse the two successful uploads");}
    const s=JSON.parse(await readFile(sessionPath,"utf8"));
    for(const file of mode==="draft"?["dress.png","blazer.png"]:[]) {
      assert.ok(state.assets.length<2);
      state.attempts.push({action:"upload",file,at:new Date().toISOString()});await persist();
      const bytes=await readFile(new URL("../public/demo/"+file,import.meta.url));
      const r=await fetch(base+"/api/uploads",{method:"POST",headers:{Cookie:s.cookie,Origin:base,"X-CSRF-Token":s.csrf,"Content-Type":"image/png"},body:bytes,signal:AbortSignal.timeout(65000)});
      const asset=await r.json();if(!r.ok)throw new Error(`Real upload returned ${r.status}: ${asset.error}`);
      state.assets.push(asset);await persist();console.log("Uploaded validated image "+state.assets.length);
    }
    const p={id:state.id,name:state.name,description:"מוצר QA זמני לבדיקת אינטגרציה בלבד. לא למכירה.",priceAgorot:12300,categoryId:state.category._id,images:state.assets,sizes:["S","M"],colors:["שחור"],status:"draft",updatedAt:new Date().toISOString(),revision:{published:null,draft:null}};
    await save("draft",p);
    const d=await docs();assert.equal(d.length,1);assert.equal(d[0]._id,"drafts."+state.id);
    state.slug=d[0].slug.current;
    assert.equal((await query('*[_id==$id]',{id:state.id},false,"published")).length,0);
    const preview=await apiRequest(`/api/products/${state.id}/preview`);assert.equal(preview.name,state.name);assert.equal(preview.images.length,2);
    const anonymous=await fetch(base+`/api/products/${state.id}/preview`);assert.equal(anonymous.status,401);
    const html=await (await fetch(site+"/catalog?qa="+Date.now())).text();assert.ok(!html.includes(state.slug));
    state.events.push({action:"draft-private-public-absence-verified",at:new Date().toISOString()});await persist();console.log("Native draft saved; private preview authorized; anonymous preview denied; public catalog excludes draft.");
  } else if(mode==="publish") {
    assert.ok(!state.attempts.some(a=>a.action==="publish"),"Only one initial publication authorized");
    await save("publish",await current()); const d=await docs();assert.equal(d.length,1);assert.equal(d[0]._id,state.id);
    state.slug=d[0].slug.current;await persist();console.log("QA publication accepted: "+state.id);
  } else if(mode==="edit") {
    assert.equal(state.attempts.filter(a=>a.action==="publish").length,1,"Only one edit-publication authorized");
    const p=await current();p.name=state.name+" — עודכן";p.priceAgorot=12400;p.description+=" עדכון QA מאושר.";
    await save("publish",p);state.updatedName=p.name;assert.equal((await docs()).find(d=>d._id===state.id).name,p.name);await persist();console.log("Same QA product changes published.");
  } else if(mode==="unpublish") {
    const p=await current();
    if(p?.status==="published") await save("unpublish",p);
    const d=await docs();assert.equal(d.length,1);assert.equal(d[0]._id,"drafts."+state.id);assert.equal(d[0].images.length,2);
    assert.deepEqual(d[0].images.map(image=>image.asset._ref),state.assets.map(asset=>asset.assetId));
    assert.equal(d[0].name,state.updatedName??state.name);
    assert.equal(d[0].priceAgorot,state.updatedName?12400:12300);
    const preview=await apiRequest(`/api/products/${state.id}/preview`);
    assert.equal(preview.status,"draft");assert.equal(preview.name,d[0].name);
    assert.equal((await query('*[_id==$id]',{id:state.id},false,"published")).length,0);
    state.events.push({action:"recoverable-native-draft-confirmed",at:new Date().toISOString()});await persist();console.log("QA product unpublished; all content retained in native draft.");
  } else if(mode==="observe") {
    const identity=await cf("/user"); assert.equal(identity.status,200); assert.equal(identity.result.email,"hadarmat@gmail.com"); state.personalCloudflareIdentityVerified=true; const deployments=await cf(`/accounts/${account}/pages/projects/fashion-catalog-demo/deployments?per_page=10`);
    const observations={at:new Date().toISOString(),deploymentsReadStatus:deployments.status,deployments:deployments.result?.map(d=>({id:d.id,created_on:d.created_on,environment:d.environment,status:d.latest_stage?.status,stages:d.stages?.map(s=>({name:s.name,status:s.status})),triggerType:d.deployment_trigger?.type})),webhooks:[]};
    for(const hook of state.hooks) {
      try {const log=await sanity(`/hooks/projects/${project}/${hook.id}/attempts`);const entries=Array.isArray(log)?log:(log.attempts??log.items??[]);observations.webhooks.push({id:hook.id,entries:entries.slice(0,8).map(a=>({id:a.id,createdAt:a.createdAt,timestamp:a.timestamp,status:a.status,statusCode:a.statusCode,httpStatus:a.httpStatus,resultCode:a.resultCode,isFailure:a.isFailure,inProgress:a.inProgress,messageId:a.messageId,keys:Object.keys(a)}))});}catch(e){observations.webhooks.push({id:hook.id,error:e.message});}
    }
    const r=await fetch(site+"/catalog?qa="+Date.now(),{headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(30000)});const html=await r.text();
    observations.catalog={status:r.status,containsQaSlug:html.includes(state.slug??state.id),containsInitialName:html.includes(state.name),containsUpdatedName:state.updatedName?html.includes(state.updatedName):false};
    state.observations??=[];state.observations.push(observations);await persist();console.log(JSON.stringify({...observations,deployments:observations.deployments?.filter(d=>d.created_on>=state.startedAt),webhooks:observations.webhooks.map(h=>({...h,entries:h.entries?.filter(e=>e.createdAt>=state.startedAt)}))},null,2));
  } else if(mode==="audit") {
    const after=await existing();assert.equal(digest(after),state.baselineDigest,"Existing non-asset documents changed during test");
    state.existingDocumentsUnchanged=true;state.finalDocuments=(await docs()).map(d=>({id:d._id,name:d.name,revision:d._rev,images:d.images?.map(i=>i.asset._ref)}));state.finishedAt=new Date().toISOString();await persist();console.log("All pre-existing non-asset documents unchanged. "+JSON.stringify(state.finalDocuments));
  } else if(mode==="finalize") {
    const observation=state.observations.at(-1);
    assert.equal(observation.catalog.containsQaSlug,false,"Wait for actual public removal");
    const builds=observation.deployments.filter(d=>d.created_on>=state.startedAt);
    assert.equal(builds.length,3);assert.ok(builds.every(d=>d.status==="success"&&d.triggerType==="deploy_hook"));
    assert.equal(state.events.filter(e=>e.action==="publish").length,2);
    assert.equal(state.events.filter(e=>e.action==="unpublish").length,1);
    assert.equal(state.existingDocumentsUnchanged,true);
    const retained=await docs();assert.equal(retained.length,1);assert.equal(retained[0]._id,"drafts."+state.id);
    state.completed=true;state.finishedAt=new Date().toISOString();await persist();
    console.log("Complete: exactly three successful hook builds, public removal and recoverable QA draft confirmed.");
  } else if(mode==="restore") {
    const {unlink}=await import("node:fs/promises");await writeFile(varsPath,await readFile(backupPath),{mode:0o600});await unlink(backupPath);await unlink(sessionPath);console.log("Original local configuration restored; temporary plaintext owner/session removed.");
  } else throw new Error("Unknown mode");
}
