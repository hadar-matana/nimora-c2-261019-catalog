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
      const response=await fetch(target.site+'/publication.json?check='+Date.now(),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
      const live=response.ok ? await response.json() as {projectId?:string;dataset?:string;fingerprint?:string}:null;
      const fresh=await this.state.storage.get<Job>(KEY);if(!fresh)return;job=fresh;
      if(live?.projectId===this.env.SANITY_PROJECT_ID && live?.dataset===this.env.SANITY_DATASET && live?.fingerprint===fingerprint){
        // A prepared mutation may still be in flight; recheck its bounded window.
        if(Date.now()<job.settleUntil){await this.state.storage.put(KEY,{...job,phase:'live'});await this.state.storage.setAlarm(Date.now()+30000);}
        else await this.state.storage.put(KEY,{...job,phase:'live',error:undefined});
        return;
      }
      if(job.phase==='building' && Date.now()-(job.started||0)<10*60000){
        // Serialize builds. A later change waits for the prior marker, or timeout.
        if(live?.fingerprint!==job.fingerprint){await this.state.storage.setAlarm(Date.now()+15000);return;}
      }
      if(job.phase==='building' && Date.now()-(job.started||0)>=10*60000){
        await this.state.storage.put(KEY,{...job,phase:'error',error:'deployment-timeout'});return;
      }
      // Persist intent BEFORE a capability request. An uncertain result is never
      // automatically retried, so a disconnect cannot duplicate a deployment.
      await this.state.storage.put(KEY,{...job,phase:'building',fingerprint,started:Date.now(),lastTrigger:Date.now()});
      stage='deploy-hook';
      const triggered=await fetch(target.hook,{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000)});
      void triggered.body?.cancel();
      if(!triggered.ok){stage='deploy-hook-http-'+triggered.status;throw new Error('hook-rejected');}
      await this.state.storage.setAlarm(Date.now()+15000);
    }catch{
      const latest=await this.state.storage.get<Job>(KEY);
      await this.state.storage.put(KEY,{...latest,phase:'error',error:stage+'-failed'});
    }
  }
}
