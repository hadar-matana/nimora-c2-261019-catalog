import "./legacy-demo-only.mjs";
// Interactive acceptance test: existing owner credentials, hidden input,
// no password persistence and no Sanity mutation/upload requests upstream.
import { hidden } from "./private-input.mjs";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
const origin="https://atelier-admin.hadarmat.workers.dev";
const reportPath=new URL("../../../docs/admin-screenshots/stage1-remote-tests.json",import.meta.url);
const sessionPath="/private/tmp/atelier-stage1-verification-session.json";
const report={startedAt:new Date().toISOString(),phase:"starting",checks:[]};
let active="starting",password="";
const expect=(ok,label)=>{if(!ok)throw new Error(label);};
async function record(label,detail={}) {
  report.checks.push({label,passed:true,...detail});
  await progress(report.phase);
  console.log("PASS "+label);
}
async function progress(phase) {report.phase=phase;await writeFile(reportPath,JSON.stringify(report,null,2)+"\n");}
async function request(path,{method="GET",body,session,headers={}}={}) {
  const r=await fetch(origin+path,{method,redirect:"manual",headers:{Origin:origin,...(session?{Cookie:session.cookie,"X-CSRF-Token":session.csrf}:{}),...(body!==undefined?{"Content-Type":"application/json"}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(30000)});
  const data=r.headers.get("Content-Type")?.includes("application/json")?await r.json():undefined;
  return {status:r.status,headers:r.headers,data};
}
async function login(username,pw) {
  const r=await request("/api/login",{method:"POST",body:{username,password:pw}});
  expect(r.status===200,"Owner login did not succeed (status "+r.status+")");
  const set=r.headers.get("set-cookie")??"";
  expect(/HttpOnly/i.test(set)&&/Secure/i.test(set)&&/SameSite=Lax/i.test(set)&&/Path=\//i.test(set),"Session cookie security attributes missing");
  expect(typeof r.data.csrf==="string"&&r.data.csrf.length===64,"CSRF response missing");
  return {cookie:set.split(";")[0],csrf:r.data.csrf,maxAge:Number(set.match(/Max-Age=(\d+)/i)?.[1])};
}
async function cfSettings() {
  const config=await readFile(homedir()+"/Library/Preferences/.wrangler/config/default.toml","utf8");
  const token=config.match(/^oauth_token\s*=\s*"([^"\n]+)"/m)?.[1];
  const headers={Authorization:"Bearer "+token};
  const u=await fetch("https://api.cloudflare.com/client/v4/user",{headers,signal:AbortSignal.timeout(20000)});
  expect(u.ok&&(await u.json()).result?.email==="hadarmat@gmail.com","Personal Cloudflare identity check failed");
  const r=await fetch("https://api.cloudflare.com/client/v4/accounts/07eb45a2b5a037d1138beea811cf549b/workers/scripts/atelier-admin/settings",{headers,signal:AbortSignal.timeout(20000)});
  expect(r.ok,"Read-only settings check failed");
  const bindings=(await r.json()).result.bindings;
  const vars=Object.fromEntries(bindings.filter(b=>b.type==="plain_text").map(b=>[b.name,b.text]));
  expect(vars.ADMIN_ORIGIN===origin&&vars.SANITY_ALLOW_PRODUCTION_WRITES==="disabled"&&vars.LOCAL_COMPAT_PROOF==="0","Wrong origin or write/security gate");
  for(const name of ["OWNER_USERNAME","OWNER_PASSWORD_HASH","CREDENTIAL_VERSION","SANITY_API_TOKEN"])
    expect(bindings.some(b=>b.name===name&&b.type==="secret_text"),"Required secret binding absent");
  return vars;
}
try {
  expect((await cfSettings()).SESSION_TTL_SECONDS==="120","Wait for the controlled 120-second acceptance policy before running");
  for(const path of ["/api/session","/api/catalog","/api/products/atelier-qa-20261015-0375d18c/preview"])
    expect((await request(path)).status===401,"Unauthenticated API was not rejected");
  expect((await request("/products/")).status===302,"Protected page did not redirect");
  await record("Unauthenticated APIs rejected; protected pages redirect to login");
  for(const cookie of ["__Host-atelier_session=invalid","__Host-atelier_session="+randomBytes(32).toString("hex")])
    expect((await request("/api/session",{headers:{Cookie:cookie}})).status===401,"Invalid session accepted");
  await record("Malformed and unknown sessions rejected");
  expect((await request("/api/login",{method:"POST",body:{username:"invalid",password:"invalid"},headers:{Origin:"https://untrusted.invalid"}})).status===403,"Login accepted foreign origin");
  await record("Login origin protection rejects foreign origin");
  console.log("Enter only your existing owner credentials below. No Sanity token is needed. Input is hidden.");
  const username=(await hidden("Existing owner username: ")).trim();
  password=await hidden("Existing owner password: ");
  active="Invalid login rejection";
  const bad=await request("/api/login",{method:"POST",body:{username,password:randomBytes(24).toString("base64url")}});
  expect(bad.status===401,"Invalid credentials did not return 401");
  await record(active);
  active="Valid login and secure cookie";
  const a=await login(username,password);
  expect(a.maxAge>=100&&a.maxAge<=120,"Short acceptance session policy not applied");
  await record(active);
  for(let n=0;n<3;n++)expect((await request("/api/session",{session:a})).status===200,"Session did not persist across requests");
  await record("Session persists across authenticated requests");
  active="Real read-only Sanity catalog";
  const catalog=await request("/api/catalog",{session:a});
  expect(catalog.status===200&&catalog.data.environment==="sanity","Real Sanity catalog failed");
  const publicUrl=new URL("https://3ahm0828.api.sanity.io/v2025-02-19/data/query/production");
  publicUrl.searchParams.set("query",'{"products":*[_type=="product"]._id,"categories":*[_type=="category"]._id}');publicUrl.searchParams.set("perspective","published");
  const publicResponse=await fetch(publicUrl,{signal:AbortSignal.timeout(30000)});expect(publicResponse.ok,"Public comparison read failed");
  const baseline=(await publicResponse.json()).result;
  expect(baseline.products.every(id=>catalog.data.products.some(p=>p.id===id))&&baseline.categories.every(id=>catalog.data.categories.some(c=>c.id===id)),"Existing catalog comparison failed");
  expect(catalog.data.products.length>=12&&catalog.data.categories.length===5,"Unexpected catalog counts");
  await record(active,{products:catalog.data.products.length,categories:catalog.data.categories.length,existingPublishedProducts:baseline.products.length});
  const preview=await request("/api/products/atelier-qa-20261015-0375d18c/preview",{session:a});
  expect(preview.status===200&&preview.data.status==="draft"&&preview.data.images.length===2,"Private native draft preview failed");
  await record("Authenticated native draft preview works; no content changes");
  active="CSRF protection";
  for(const headers of [{Origin:"https://untrusted.invalid"},{"X-CSRF-Token":"invalid"},{"X-CSRF-Token":""}])
    expect((await request("/api/logout",{method:"POST",session:a,headers})).status===403,"Logout CSRF/origin protection failed");
  expect((await request("/api/session",{session:a})).status===200,"Rejected CSRF request revoked the valid session");
  await record(active);
  active="All production mutation and upload routes disabled";
  for(const action of ["draft","publish","unpublish"])
    expect((await request("/api/products/stage1-disabled-probe",{method:"POST",session:a,body:{action,product:{id:"stage1-disabled-probe"}}})).status===403,"Production product action was not disabled");
  expect((await request("/api/categories",{method:"POST",session:a,body:{categories:[]}})).status===403,"Category mutations not disabled");
  expect((await request("/api/uploads",{method:"POST",session:a,body:{}})).status===403,"Upload route not disabled");
  await record(active,{qualification:"Requests contain no valid product/image; read-only guard rejects before parsing or Sanity network calls."});
  active="Logout revokes the session";
  const logout=await request("/api/logout",{method:"POST",session:a});
  expect(logout.status===200&&/Max-Age=0/i.test(logout.headers.get("set-cookie")??""),"Logout did not clear cookie");
  expect((await request("/api/session",{session:a})).status===401,"Revoked cookie replay succeeded");
  await record(active);
  const b=await login(username,password);
  const issued=await request("/api/session",{session:b});
  expect(issued.status===200&&issued.data.expires>Date.now()&&issued.data.expires<Date.now()+121000,"Expiry timestamp missing");
  await writeFile(sessionPath,JSON.stringify(b),{mode:0o600,flag:"wx"});
  report.shortSessionExpiresAt=new Date(issued.data.expires).toISOString();
  await progress("awaiting-default-policy");
  console.log("Waiting for the operator to restore the eight-hour default on the same Worker. Leave this terminal open.");
  const deadline=Date.now()+90_000;
  while((await cfSettings()).SESSION_TTL_SECONDS!=="28800") {
    expect(Date.now()<deadline,"Default-policy restoration timed out");await new Promise(r=>setTimeout(r,3000));
  }
  active="Durable session survives Worker update";
  expect((await request("/api/session",{session:b})).status===200,"Session failed across Worker update");
  await record(active);
  await progress("waiting-for-expiry");
  await new Promise(r=>setTimeout(r,Math.max(0,issued.data.expires-Date.now()+1200)));
  active="Expired stored session is rejected";
  expect((await request("/api/session",{session:b})).status===401,"Expired session accepted");
  await record(active,{shortTestSeconds:120,normalDefaultHours:8});
  const c=await login(username,password);password="";
  expect(c.maxAge>=28750&&c.maxAge<=28800,"Eight-hour default cookie not restored");
  const normal=await request("/api/session",{session:c});expect(normal.status===200&&normal.data.expires>Date.now()+28_700_000,"Normal expiry timestamp incorrect");
  await writeFile(sessionPath,JSON.stringify(c),{mode:0o600});
  await record("Normal eight-hour session policy restored and new session works");
  report.finishedAt=new Date().toISOString();await progress("api-checks-complete");
  console.log("Remote API checks complete. Return to chat with only this success message. Keep credentials private.");
} catch(error) {
  password="";
  report.failure={check:active,message:error.name==="TypeError"?"Network or response failure":error.message};
  await progress("failed");
  console.error("Stage 1 verification stopped at: "+active+". "+report.failure.message+". Do not share any private input.");process.exitCode=1;
}
