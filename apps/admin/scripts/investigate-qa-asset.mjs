// Read-only history investigation: one existing QA asset, no mutation endpoint.
import {readFile,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import assert from 'node:assert/strict';
const id='image-af8d2a2cbbb9278c67b882d717a82fa5493e005f-1086x1448-png';
const token=JSON.parse(await readFile(homedir()+'/.config/sanity/config.json','utf8')).authToken;
const api='https://3ahm0828.api.sanity.io/v2025-02-19';
async function get(path){const r=await fetch(api+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,'History GET rejected: '+r.status);return r.json();}
assert.equal((await get('/users/me')).email,'hadarmat@gmail.com','Personal Sanity account required');
const before=(await get('/data/history/production/documents/'+id+'?time=2026-10-15T19%3A20%3A45Z')).documents[0];
const after=(await get('/data/history/production/documents/'+id+'?time=2026-10-15T19%3A21%3A00Z')).documents[0];
assert.equal(before._id,id);assert.equal(after._id,id);
const changes=[];
function diff(a,b,path=''){
 if(JSON.stringify(a)===JSON.stringify(b))return;
 if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b)){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],path?path+'.'+k:k);return;}
 changes.push({field:path,before:a??null,after:b??null});
}
diff(before,after);
const result={at:new Date().toISOString(),assetId:id,source:'Authenticated read-only Sanity History API snapshots immediately before/after the authorized upload',beforeRevision:before._rev,afterRevision:after._rev,changes};
await writeFile(new URL('../../../docs/admin-screenshots/upload-asset-history.json',import.meta.url),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
