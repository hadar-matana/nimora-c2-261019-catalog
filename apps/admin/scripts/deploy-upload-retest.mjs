import "./legacy-demo-only.mjs";
// One activation on the existing Worker, followed by fail-closed restoration.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {load,persist} from './upload-retest-control.mjs';
import {identity,settings} from './stage2-control.mjs';
const mode=process.argv[2];assert.ok(['activate','disable'].includes(mode));await identity();
const s=await load(),b=(await settings()).bindings;assert.equal(b.find(x=>x.name==='SANITY_ALLOW_PRODUCTION_WRITES').text,'disabled');
if(mode==='activate'){assert.ok(!s.activationAttempted);assert.equal(s.attempts.length,0);s.activationAttempted=true;s.activationStartedAt=new Date().toISOString();}
const until=mode==='activate'?String(Date.now()+20*60000):'0';s.uploadGateUntil=until;await persist(s);
const result=spawnSync('pnpm',['--filter','admin','exec','wrangler','deploy','--config','worker/wrangler.release.jsonc','--var','SANITY_UPLOAD_RETEST_UNTIL:'+until],{encoding:'utf8',env:{...process.env,WRANGLER_LOG_PATH:'/private/tmp/atelier-upload-retest-deploy.log',WRANGLER_SEND_METRICS:'false'}});
process.stdout.write(result.stdout??'');process.stderr.write(result.stderr??'');s.deployments??=[];s.deployments.push({mode,at:new Date().toISOString(),exitCode:result.status,version:result.stdout?.match(/Current Version ID: ([a-f0-9-]+)/)?.[1]??null});await persist(s);if(result.status!==0)process.exitCode=1;
