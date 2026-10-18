// Optional read-only build test harness. Keep captured public CMS responses outside Git.
// NODE_OPTIONS='--require /absolute/path/cms-snapshot.cjs'
// PHASE_A_CMS_SNAPSHOT_DIR=/private/tmp/chosen-snapshot
const fs = require('node:fs');
const crypto = require('node:crypto');
const nativeFetch = globalThis.fetch;
const directory = process.env.PHASE_A_CMS_SNAPSHOT_DIR;
if (!directory) throw new Error('PHASE_A_CMS_SNAPSHOT_DIR is required');
fs.mkdirSync(directory, {recursive: true});
globalThis.fetch = async (input, init) => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(raw);
  if (!url.hostname.endsWith('.api.sanity.io')) return nativeFetch(input, init);
  const method = init?.method || input?.method || 'GET';
  if (method !== 'GET' || !/^\/v[\d-]+\/data\/query\//.test(url.pathname)) throw new Error('CMS snapshot permits GET queries only');
  url.searchParams.sort();
  const file = directory + '/' + crypto.createHash('sha256').update(url.href).digest('hex') + '.json';
  if (fs.existsSync(file)) {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    return new Response(saved.body, {status: saved.status, headers: {'Content-Type': 'application/json'}});
  }
  const response = await nativeFetch(input, init);
  const body = await response.text();
  if (!response.ok) throw new Error('CMS snapshot query failed');
  fs.writeFileSync(file, JSON.stringify({body, status: response.status}));
  return new Response(body, {status: response.status, headers: {'Content-Type': 'application/json'}});
};
