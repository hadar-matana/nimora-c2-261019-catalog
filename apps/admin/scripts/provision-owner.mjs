import "./legacy-demo-only.mjs";
// Run manually in a private local terminal. Secrets stay in memory and are sent
// directly to the existing private Worker; no values are printed or saved.
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { hidden } from "./private-input.mjs";

const account="07eb45a2b5a037d1138beea811cf549b";
const script=`/accounts/${account}/workers/scripts/atelier-admin`;
const project="3ahm0828";
if(!process.stdin.isTTY||!process.stdout.isTTY) throw new Error("Use a private interactive terminal, not a redirected command or chat.");
const config=await readFile(homedir()+"/Library/Preferences/.wrangler/config/default.toml","utf8");
const cfToken=config.match(/^oauth_token\s*=\s*"([^"\n]+)"/m)?.[1];
assert.ok(cfToken,"Existing personal Cloudflare login is required");
async function cf(path,options={}) {
  const r=await fetch("https://api.cloudflare.com/client/v4"+path,{...options,headers:{Authorization:"Bearer "+cfToken,...options.headers},signal:AbortSignal.timeout(30000)});
  const data=await r.json();
  if(!r.ok||!data.success)throw new Error(`Cloudflare request failed (${r.status}); no automatic retry. Keep public access disabled.`);
  return data.result;
}

try {
  const user=await cf("/user");assert.equal(user.email,"hadarmat@gmail.com","Wrong Cloudflare identity");
  const settings=await cf(script+"/settings");
  const vars=Object.fromEntries(settings.bindings.filter(b=>b.type==="plain_text").map(b=>[b.name,b.text]));
  assert.equal(vars.ADMIN_REMOTE_ENABLED,"disabled","Provision only while application access is disabled");
  assert.equal(vars.SANITY_ALLOW_PRODUCTION_WRITES,"disabled");
  const routing=await cf(script+"/subdomain");assert.equal(routing.enabled,false);assert.equal(routing.previews_enabled,false);
  console.log("Personal account verified. Worker is private; production writes are disabled. All input below is hidden.");
  const username=(await hidden("Choose owner username (3–80 ASCII letters/digits/_/-): ")).trim();
  assert.match(username,/^[a-zA-Z0-9_-]{3,80}$/);
  assert.ok(!/^(qa-|proof-)/i.test(username),"Do not reuse a QA/proof account");
  let password=await hidden("Choose a NEW unique owner password (16+ characters, maximum 72 UTF-8 bytes): ");
  assert.ok(password.length>=16&&!bcrypt.truncates(password),"Password must be at least 16 characters and at most 72 UTF-8 bytes");
  if(await hidden("Confirm owner password: ")!==password)
    throw new Error("Passwords do not match; no credentials were installed.");
  let sanityToken=(await hidden("Paste the dedicated Sanity Viewer token (hidden): ")).trim();
  assert.ok(sanityToken.length>=30&&!/\s/.test(sanityToken),"Invalid token input");
  if(await hidden("Confirm the token was created with Viewer access; type VIEWER: ")!=="VIEWER")
    throw new Error("Viewer confirmation required; no credentials were installed.");
  try {
    const personal=JSON.parse(await readFile(homedir()+"/.config/sanity/config.json","utf8"));
    if(sanityToken===personal.authToken)
      throw new Error("Do not deploy the broad personal CLI credential; use the dedicated Viewer token.");
  } catch(error) {if(error.code!=="ENOENT")throw error;}
  const url=new URL(`https://${project}.api.sanity.io/v2025-02-19/data/query/production`);
  url.searchParams.set("query",'{"products":count(*[_type=="product"]),"categories":count(*[_type=="category"])}');url.searchParams.set("perspective","raw");
  const read=await fetch(url,{headers:{Authorization:"Bearer "+sanityToken},signal:AbortSignal.timeout(30000)});
  assert.equal(read.status,200,"Viewer token cannot read the expected project/dataset; no secrets were installed");
  const counts=(await read.json()).result;assert.ok(Number.isInteger(counts.products)&&counts.categories>0);
  const hash=await bcrypt.hash(password,12);password="";
  const secrets={OWNER_USERNAME:username,OWNER_PASSWORD_HASH:hash,CREDENTIAL_VERSION:randomBytes(32).toString("hex"),SANITY_API_TOKEN:sanityToken};
  const installed=[];
  for(const [name,text] of Object.entries(secrets)) {
    await cf(script+"/secrets",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,text,type:"secret_text"})});
    installed.push(name);
    secrets[name]="";
  }
  sanityToken="";
  await writeFile(new URL("../../../docs/admin-screenshots/stage1-owner-provisioning.json",import.meta.url),JSON.stringify({at:new Date().toISOString(),personalIdentityVerified:true,installedSecretNames:installed,viewerRoleConfirmedByOperator:true,realSanityReadSucceeded:true,counts,publicAccessEnabled:false,productionWritesEnabled:false},null,2)+"\n");
  console.log("Owner credentials and the dedicated read token are installed securely. No secret values were saved locally. Public access and Sanity writes remain disabled. Return to the chat and say provisioning is complete; do not share your credentials.");
} catch(error) {
  // AssertionError messages may contain actual/expected input. Never print them.
  console.error(error instanceof assert.AssertionError
    ? "Provisioning validation failed. Check the personal account, private access gates, username/password requirements and dedicated Viewer read access. No secret values are shown."
    : error.message);
  process.exitCode=1;
}
