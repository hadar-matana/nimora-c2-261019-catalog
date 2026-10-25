"use client";
import {useEffect,useState} from 'react';

export function PublishingStatus(){
  const [phase,setPhase]=useState('disabled');
  const [checking,setChecking]=useState(false);
  useEffect(()=>{
    let active=true;
    async function check(){
      try{const r=await fetch('/api/publishing',{cache:'no-store'});if(r.ok){const d=await r.json();if(active)setPhase(d.phase);}}
      catch{if(active)setPhase('unavailable');}
    }
    void check();const timer=setInterval(()=>void check(),10000);
    return()=>{active=false;clearInterval(timer);};
  },[]);
  if(phase==='disabled')return null;
  const messages:Record<string,string>={queued:'השינוי נשמר. מעדכנים את האתר…',building:'הנתונים נשמרו. פרסום האתר בתהליך…',live:'האתר מעודכן',error:'הנתונים נשמרו, אך פרסום האתר לא הושלם.',unavailable:'לא ניתן לבדוק כעת את מצב הפרסום.'};
  return <div role="status" style={{padding:'12px 24px'}}>{messages[phase]||messages.unavailable}
    {phase==='error'&&<button disabled={checking} onClick={async()=>{
      setChecking(true);
      try{const s=await fetch('/api/session',{cache:'no-store'});if(!s.ok)throw Error();const {csrf}=await s.json();const r=await fetch('/api/publishing/retry',{method:'POST',headers:{'X-CSRF-Token':csrf}});if(!r.ok)throw Error();setPhase('queued');}
      catch{setPhase('unavailable');}finally{setChecking(false);}
    }}>ניסיון פרסום נוסף</button>}
  </div>;
}
