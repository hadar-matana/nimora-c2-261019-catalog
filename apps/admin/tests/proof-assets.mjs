import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
const account=JSON.parse(await readFile('/private/tmp/atelier-local-proof-account.json','utf8'));
const vars=await readFile(new URL('../worker/.dev.vars',import.meta.url),'utf8');
const hash=vars.match(/^OWNER_PASSWORD_HASH=(.*)$/m)[1];
let checked=0;
async function scan(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await scan(path);else if(/\.(js|html|json|txt)$/.test(path)){const text=await readFile(path,'utf8');assert.ok(!text.includes(account.password),'Temporary account password must not be exported');assert.ok(!text.includes(hash),'Server password hash must not be exported');assert.ok(!text.includes(account.username),'Local account username must not be exported');checked++;}}}
await scan(new URL('../out/',import.meta.url).pathname);
console.log(`PASS ${checked} exported text assets contain no local account credentials or password hash`);
