import "./legacy-demo-only.mjs";
// Run in a private terminal. Password exists only in process memory.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {hidden} from './private-input.mjs';
const origin='https://atelier-admin.hadarmat.workers.dev';
let password='';
try{
 console.log('Enter existing owner credentials only. Inputs are hidden. No Sanity token is needed.');
 const username=(await hidden('Existing owner username: ')).trim();password=await hidden('Existing owner password: ');
 const r=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,password}),signal:AbortSignal.timeout(30000)});password='';
 assert.equal(r.status,200);const data=await r.json(),cookie=r.headers.get('set-cookie');assert.ok(cookie?.includes('HttpOnly')&&data.csrf);
 await writeFile('/private/tmp/atelier-stage2-session.json',JSON.stringify({cookie:cookie.split(';')[0],csrf:data.csrf}),{mode:0o600,flag:'wx'});
 console.log('Private Stage 2 test session ready. No password saved. Return to chat and say the helper completed; share no credentials.');
}catch{password='';console.error('Private login failed; no credentials displayed. Check the owner credentials, network, or login rate limit.');process.exitCode=1;}
