"use client";
import {useEffect, useRef, useState, type FormEvent} from 'react';
import {Shell} from '@/components/Shell';
import {useAdmin} from '@/components/AdminContext';
type About = {heading: string; intro: string; body: string; revision: string | null; editable: boolean};
const empty: About = {heading:'', intro:'', body:'', revision:null, editable:false};
function AboutEditor() {
  const store = useAdmin();
  const live = process.env.NEXT_PUBLIC_ADMIN_LOCAL_PROOF === '1';
  const [value, setValue] = useState<About>({...empty, editable: !live}), [loaded, setLoaded] = useState(!live), [busy, setBusy] = useState(false), [error, setError] = useState(''), [preview, setPreview] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    if (!store.signedIn || !live) return;
    let active = true;
    fetch('/api/about', {cache:'no-store', credentials:'same-origin'}).then(async r => {const data = await r.json(); if(!r.ok) throw new Error(data.error || 'טעינת אודות נכשלה'); if(active){setValue(data);setLoaded(true);}}).catch(e => {if(active) setError(e.message);});
    return () => {active=false;};
  }, [store.signedIn, live]);
  async function save(event: FormEvent) {
    event.preventDefault(); if(lock.current) return;
    lock.current=true;setBusy(true);setError('');
    try {
      if(live) {
        const session = await fetch('/api/session',{cache:'no-store',credentials:'same-origin'});
        if(!session.ok) throw new Error('נדרשת כניסה מחדש');
        const {csrf} = await session.json();
        const response = await fetch('/api/about',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({heading:value.heading,intro:value.intro,body:value.body,revision:value.revision})});
        const data = await response.json(); if(!response.ok) throw new Error(data.error || 'השמירה נכשלה');setValue(data);
      }
      store.notify(live ? 'התוכן נשמר. האתר יתעדכן לאחר השלמת הפרסום.' : 'התצוגה המקומית עודכנה. התוכן אינו נשמר בשרת.');
    } catch(e) {setError(e instanceof Error ? e.message : 'השמירה נכשלה');}
    finally{lock.current=false;setBusy(false);}
  }
  return <><div className="page-heading"><div><span className="eyebrow">הסיפור של החנות</span><h1>אודות</h1><p>מקום להכיר אתכן, במילים שלכן.</p></div></div>
    {error && <p className="field-error" role="alert">{error} <button type="button" className="button secondary" onClick={()=>window.location.reload()}>טעינה מחדש</button></p>}
    {!loaded ? <p role="status">טוענים את התוכן…</p> : <form onSubmit={save} className="about-editor category-panel">
      {!value.editable && <p role="alert">טרם הוגדרו הגדרות האתר. פני למנהלת המערכת.</p>}
      <fieldset disabled={busy || !value.editable}><label htmlFor="about-heading">כותרת העמוד</label><input id="about-heading" maxLength={120} value={value.heading} onChange={e=>setValue({...value,heading:e.target.value})} placeholder="הסיפור שלנו"/>
      <label htmlFor="about-intro">פתיח (לא חובה)</label><textarea id="about-intro" maxLength={600} rows={3} value={value.intro} onChange={e=>setValue({...value,intro:e.target.value})}/>
      <label htmlFor="about-body">הסיפור שלנו</label><p id="paragraph-help" className="field-help">השאירי שורה ריקה בין פסקאות. אפשר להשאיר ריק ולמלא בהמשך.</p><textarea id="about-body" aria-describedby="paragraph-help" maxLength={12000} rows={12} value={value.body} onChange={e=>setValue({...value,body:e.target.value})}/>
      <p className="field-help">שמירה מפרסמת את תוכן אודות באתר. העדכון יופיע לאחר השלמת בניית האתר, שעשויה לקחת כמה דקות.</p>
      <div className="about-actions"><button className="button primary">{busy?'שומרים…':'שמירה ופרסום'}</button><button type="button" className="button secondary" aria-expanded={preview} onClick={()=>setPreview(!preview)}>תצוגה מקדימה</button></div></fieldset>
      {preview && <section className="about-preview" aria-label="תצוגה מקדימה מקומית"><h2>{value.heading.trim() || 'הסיפור שלנו'}</h2>{value.intro && <p>{value.intro}</p>}{value.body.trim() ? value.body.trim().split(/\n\s*\n/).map((p,i)=><p key={i} dir="auto">{p}</p>) : <p>עוד מעט נשתף כאן את הסיפור שלנו. בינתיים, מוזמנות לגלות את הפריטים.</p>}</section>}
    </form>}</>;
}
export default function AboutPage(){return <Shell><AboutEditor/></Shell>;}
