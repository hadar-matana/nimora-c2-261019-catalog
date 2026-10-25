import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {publicationFingerprint} from '../../../packages/config/publication.mjs';

const env = process.env;
const enabled = env.STOREFRONT_PUBLICATION_TRACKING === 'approved';
const fingerprint = () => publicationFingerprint(env.NEXT_PUBLIC_SANITY_PROJECT_ID, env.NEXT_PUBLIC_SANITY_DATASET, env.NEXT_PUBLIC_SANITY_API_VERSION);
const before = enabled ? await fingerprint() : null;
// Preserve the reviewed static export cleanup, including empty catalogs.
for (const [command,args] of [['pnpm',['exec','next','build','--webpack']],['node',['scripts/clean-empty-product-export.mjs']]]) {
  const child=spawnSync(command,args,{stdio:'inherit',env});
  if(child.status!==0)process.exit(child.status||1);
}
if(enabled){
  const after=await fingerprint();
  if(before!==after)throw new Error('Published catalog changed during build; refusing a stale publication marker');
  await writeFile('out/publication.json',JSON.stringify({projectId:env.NEXT_PUBLIC_SANITY_PROJECT_ID,dataset:env.NEXT_PUBLIC_SANITY_DATASET,fingerprint:after}));
}
