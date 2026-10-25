import { cmsTarget } from './deployment.mjs';

// Only published, storefront-relevant revisions. Draft saves and orphan uploads
// cannot alter this fingerprint. Uses the API rather than an eventually cached CDN.
export async function publicationFingerprint(projectId, dataset, apiVersion) {
  const target = cmsTarget(projectId, dataset, apiVersion);
  const url = new URL(`${target.origin}/v${apiVersion}/data/query/${dataset}`);
  url.searchParams.set('perspective', 'published');
  url.searchParams.set('query', '*[_type in ["product","category","collection","catalogOptions","siteSettings"] && !(_id in path("drafts.**")) && !(_id in path("versions.**"))] | order(_id asc) {_id,_rev}');
  const response = await fetch(url, {cache:'no-store', signal:AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error('Published catalog unavailable');
  const {result} = await response.json();
  if (!Array.isArray(result) || result.length > 10000 || result.some(r => typeof r._id !== 'string' || typeof r._rev !== 'string')) throw new Error('Invalid publication inventory');
  const bytes = new TextEncoder().encode(JSON.stringify(result.map(r=>[r._id,r._rev])));
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
}
