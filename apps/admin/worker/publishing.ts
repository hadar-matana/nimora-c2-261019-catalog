import {publicationFingerprint} from '../../../packages/config/publication.mjs';

export type PublishingEnv = {
  PUBLISHING_ENABLED?: string;
  PUBLISHING_PROJECT_ID?: string;
  PUBLISHING_DATASET?: string;
  PUBLISHING_PAGES_PROJECT?: string;
  PUBLISHING_HOOK_ID?: string;
  PUBLISHING_HOOK_URL?: string;
  SANITY_PROJECT_ID?: string;
  SANITY_DATASET?: string;
  SANITY_API_VERSION?: string;
};
export function publishingTarget(env: PublishingEnv) {
  if(env.PUBLISHING_ENABLED!=='approved')throw new Error('Publishing disabled');
  if(!env.PUBLISHING_PROJECT_ID || env.PUBLISHING_PROJECT_ID!==env.SANITY_PROJECT_ID || env.PUBLISHING_DATASET!==env.SANITY_DATASET)throw new Error('Publishing target mismatch');
  if(!/^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$/.test(env.PUBLISHING_PAGES_PROJECT||'') || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(env.PUBLISHING_HOOK_ID||''))throw new Error('Invalid publishing binding');
  const url=new URL(env.PUBLISHING_HOOK_URL||'');
  if(url.href!==`https://api.cloudflare.com/client/v4/pages/webhooks/deploy_hooks/${env.PUBLISHING_HOOK_ID}`)throw new Error('Invalid publishing hook');
  return {hook:url.href,site:`https://${env.PUBLISHING_PAGES_PROJECT}.pages.dev`};
}
type Job={phase:'queued'|'building'|'live'|'error';changed:number;settleUntil:number;started?:number;fingerprint?:string;error?:string;lastTrigger?:number;checks?:number};
const KEY='publication';
const reply=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'no-store'}});
export async function publicMarker(site:string){
  let url=site+'/publication.json';
  for(let hop=0;hop<3;hop++){
    const r=await fetch(url,{cache:'no-store',redirect:'manual',signal:AbortSignal.timeout(15000)});
    if(r.status>=300&&r.status<400){
      const next=new URL(r.headers.get('Location')||'',url);
      void r.body?.cancel();
      if(next.origin!==site||next.pathname!=='/publication.json'||next.username||next.password||next.hash)throw new Error('Marker redirect target rejected');
      url=next.href;continue;
    }
    if(!r.ok){void r.body?.cancel();return null;}
    return await r.json() as {projectId?:string;dataset?:string;fingerprint?:string};
  }
  throw new Error('Marker redirect limit');
}

// A separate named instance in the existing namespace. No sessions, passwords,
// tokens or capability URLs are persisted here or returned to the browser.
export class PublishingQueue {
  constructor(private state:DurableObjectState,private env:PublishingEnv){}
  async fetch(request:Request){
    const path=new URL(request.url).pathname;
    if(path==='/publication/status')return reply((await this.state.storage.get<Job>(KEY))||{phase:'live'});
    publishingTarget(this.env);
    if(!['/publication/prepare','/publication/commit','/publication/retry'].includes(path))return new Response(null,{status:404});
    await this.state.storage.transaction(async tx=>{
      const old=await tx.get<Job>(KEY);
      const now=Date.now();
      // Preserve an active build; subsequent edits are picked up after it settles.
      await tx.put(KEY,{...old,phase:old?.phase==='building'?'building':'queued',changed:now,settleUntil:now+120000,error:undefined});
      await tx.setAlarm(now+10000);
    });
    return reply({accepted:true});
  }
  async alarm(){
    let job=await this.state.storage.get<Job>(KEY);if(!job)return;
    if(job.phase==='error')return;
    let stage='configuration';
    try{
      const target=publishingTarget(this.env);
      stage='published-inventory';
      const fingerprint=await publicationFingerprint(this.env.SANITY_PROJECT_ID,this.env.SANITY_DATASET,this.env.SANITY_API_VERSION);
      stage='public-marker';
      const live=await publicMarker(target.site);
      const fresh=await this.state.storage.get<Job>(KEY);if(!fresh)return;job=fresh;
      if(live?.projectId===this.env.SANITY_PROJECT_ID && live?.dataset===this.env.SANITY_DATASET && live?.fingerprint===fingerprint){
        // A prepared mutation may still be in flight; recheck its bounded window.
        if(Date.now()<job.settleUntil){await this.state.storage.put(KEY,{...job,phase:'live'});await this.state.storage.setAlarm(Date.now()+30000);}
        else await this.state.storage.put(KEY,{...job,phase:'live',error:undefined});
        return;
      }
      const newerContent=job.phase==='building' && fingerprint!==job.fingerprint && Date.now()-(job.started||0)>=10000;
      if(job.phase==='building' && !newerContent && Date.now()-(job.started||0)<10*60000){
        // A newer revision needs a follow-up even if the previous build rejects
        // a changing snapshot. Pages queues it; never replay the same fingerprint.
        if(live?.fingerprint!==job.fingerprint){await this.state.storage.setAlarm(Date.now()+15000);return;}
      }
      if(job.phase==='building' && !newerContent && Date.now()-(job.started||0)>=10*60000){
        await this.state.storage.put(KEY,{...job,phase:'error',error:'deployment-timeout'});return;
      }
      // Persist intent BEFORE a capability request. An uncertain result is never
      // automatically retried, so a disconnect cannot duplicate a deployment.
      await this.state.storage.put(KEY,{...job,phase:'building',fingerprint,started:Date.now(),lastTrigger:Date.now()});
      stage='deploy-hook';
      const triggered=await fetch(target.hook,{method:'POST',redirect:'manual',signal:AbortSignal.timeout(15000)});
      void triggered.body?.cancel();
      if(triggered.status>=300&&triggered.status<400){
        const redirected=new URL(triggered.headers.get('Location')||'',target.hook);
        const expected=new URL(target.hook);
        const host=redirected.origin===expected.origin?'same-origin':'foreign-origin';
        const path=redirected.pathname===expected.pathname?'same-path':redirected.pathname===expected.pathname+'/'?'trailing-slash':'other-path';
        stage=`deploy-hook-http-${triggered.status}-${host}-${path}`;
        throw new Error('Hook redirect rejected');
      }
      if(!triggered.ok){stage='deploy-hook-http-'+triggered.status;throw new Error('hook-rejected');}
      await this.state.storage.setAlarm(Date.now()+15000);
    }catch(error){
      // Classify runtime failures without ever persisting their raw message,
      // which can contain the secret-bearing deploy-hook capability.
      const message=error instanceof Error?error.message:'';
      const category=/redirect/i.test(message)?'redirect':/1042|worker.to.worker|same.zone/i.test(message)?'worker-routing':/cache.*(unsupported|not implemented)|unsupported.*cache/i.test(message)?'cache-option':/JSON|unexpected token/i.test(message)?'invalid-json':/network|fetch failed/i.test(message)?'network':/abort|timeout/i.test(message)?'timeout':'runtime';
      const latest=await this.state.storage.get<Job>(KEY);
      await this.state.storage.put(KEY,{...latest,phase:'error',error:stage+'-'+category});
    }
  }
}
